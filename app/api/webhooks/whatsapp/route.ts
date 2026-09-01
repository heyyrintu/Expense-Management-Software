// WhatsApp Cloud API webhook (PLAN 8.1 infra, 8.2 capture).
//
// GET  — Meta's subscription handshake (hub.mode / hub.verify_token / hub.challenge).
// POST — inbound messages. Order of operations matters:
//   1. parse the payload only far enough to read metadata.phone_number_id
//   2. resolve THAT business number to an org (never the sender's number —
//      the same personal number may be linked in several orgs)
//   3. verify X-Hub-Signature-256 against that org's app secret
//   4. match the sender to a verified WhatsAppLink inside the org
//   5. button tap  -> idempotent capture callback (8.2)
//      receipt/text -> draft expense + summary reply with buttons (8.2)
//   Unknown numbers get one canned, rate-limited "link your number" reply
//   and nothing is stored.
//
// Meta retries on any non-200, so all soft failures answer 200.
import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/db/scoped";
import { checkRateLimit } from "@/lib/rate-limit";
import { orgForPhoneNumberId } from "@/lib/whatsapp";
import { handleCaptureCallback } from "@/lib/whatsapp/callbacks";
import {
  captureButtons,
  decodeButtonPayload,
  HELP_REPLY,
} from "@/lib/whatsapp/capture";
import {
  captureMediaMessage,
  captureTextMessage,
  type CaptureOutcome,
} from "@/lib/whatsapp/ingest";
import { handleQuickApprove } from "@/lib/whatsapp/approve";
import { decodeApprovalPayload } from "@/lib/whatsapp/templates";
import { buttonPayloadOf, parseInbound, parseStatuses } from "@/lib/whatsapp/meta";
import type { InboundMessage, WhatsAppProvider } from "@/lib/whatsapp/types";
import type { DeliveryStatus } from "@/lib/whatsapp/meta";
import type { Role } from "@/lib/auth/roles";

export const runtime = "nodejs";

const NOT_LINKED_REPLY =
  "This number isn't linked to an expense account yet. Sign in to the expenses app, open your profile and add this WhatsApp number to get started.";

const MEDIA_TYPES = new Set(["image", "document"]);

/** Meta's handshake. Any mismatch is a flat 403 with no detail. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const phoneNumberId =
    url.searchParams.get("phone_number_id") ?? process.env.WA_PHONE_NUMBER_ID ?? "";
  const resolved = phoneNumberId ? await orgForPhoneNumberId(phoneNumberId) : null;
  if (!resolved) return new Response("Forbidden", { status: 403 });

  const challenge = resolved.provider.verifyWebhook({
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
  });
  if (challenge === null) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  // The signature covers the RAW bytes, so read the body as text first.
  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true }); // not ours to interpret
  }

  const messages = parseInbound(payload);
  const statuses = parseStatuses(payload);
  if (messages.length === 0 && statuses.length === 0) {
    return NextResponse.json({ ok: true }); // edits, reactions, etc.
  }

  // Every message in one webhook shares the receiving business number.
  const phoneNumberId =
    messages[0]?.phoneNumberId ?? businessNumberOf(payload) ?? "";
  const resolved = await orgForPhoneNumberId(phoneNumberId);
  if (!resolved) {
    console.warn("[whatsapp] no org for phone_number_id", phoneNumberId);
    return NextResponse.json({ ok: true });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!resolved.provider.verifySignature(rawBody, signature)) {
    console.warn("[whatsapp] bad signature for", phoneNumberId);
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const db = scopedDb(resolved.orgId);

  // Delivery receipts for messages WE sent (8.3 ops visibility).
  for (const status of statuses) {
    try {
      await recordDeliveryStatus(db, status);
    } catch (e) {
      console.error("[whatsapp] status update failed:", e);
    }
  }

  for (const message of messages) {
    try {
      await handleMessage(db, resolved.orgId, message, resolved.provider);
    } catch (e) {
      console.error("[whatsapp] message handling failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleMessage(
  db: ReturnType<typeof scopedDb>,
  orgId: string,
  message: InboundMessage,
  provider: WhatsAppProvider
): Promise<void> {
  // Cheap flood guard per sending number, before any database write.
  if (!(await checkRateLimit("whatsappInbound", `${orgId}:${message.from}`))) {
    console.warn("[whatsapp] rate limited", message.from);
    return;
  }

  // Sender must own a VERIFIED link in this org. Unverified or opted-out
  // links are treated as unknown.
  const link = (await db.whatsAppLink.findFirst({
    where: {
      phoneE164: message.from,
      verifiedAt: { not: null },
      optedOut: false,
    },
    select: { userId: true, user: { select: { status: true, role: true } } },
  })) as { userId: string; user: { status: string; role: Role } } | null;

  if (!link || link.user.status !== "active") {
    // One canned reply per number per window — never say whether the number
    // exists elsewhere, and store nothing.
    if (await checkRateLimit("whatsappReply", `${orgId}:${message.from}`)) {
      await provider.sendText(message.from, NOT_LINKED_REPLY);
    }
    return;
  }

  // Any inbound message opens Meta's 24-hour session window for this person,
  // which is what lets 8.3 send free-form messages instead of templates.
  await db.whatsAppLink.updateMany({
    where: { userId: link.userId },
    data: { lastInboundAt: message.receivedAt },
  });

  // Record the message first. The unique waMessageId means a redelivery from
  // Meta stops here, before any expense is created or deleted.
  const stored = await storeInbound(db, orgId, message, link.userId);
  if (!stored) return; // duplicate delivery — already handled

  const buttonPayload = buttonPayloadOf(message);

  // ---- Quick approve (8.3) -------------------------------------------------
  const approval = decodeApprovalPayload(buttonPayload);
  if (approval) {
    const result = await handleQuickApprove(
      db,
      orgId,
      { userId: link.userId, role: link.user.role },
      approval.action,
      approval.reportId
    );
    await db.whatsAppInbound.update({
      where: { id: stored.id },
      data: { status: "processed", processedAt: new Date() },
    });
    await provider.sendText(message.from, result.reply);
    return;
  }

  // ---- Button tap (8.2 capture actions) ------------------------------------
  const callback = decodeButtonPayload(buttonPayload);
  if (callback) {
    const result = await handleCaptureCallback(
      db,
      orgId,
      link.userId,
      callback.action,
      callback.inboundId
    );
    await db.whatsAppInbound.update({
      where: { id: stored.id },
      data: { status: "processed", processedAt: new Date() },
    });
    await provider.sendText(message.from, result.reply);
    return;
  }

  // ---- Receipt or text -> draft expense ------------------------------------
  const org = (await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { currency: true },
  })) as { currency: string };

  const ctx = {
    db,
    orgId,
    orgCurrency: org.currency,
    userId: link.userId,
    message,
  };

  let outcome: CaptureOutcome;
  if (MEDIA_TYPES.has(message.type)) {
    outcome = await captureMediaMessage(ctx, provider);
  } else if (message.type === "text") {
    outcome = await captureTextMessage(ctx);
  } else {
    outcome = { reply: HELP_REPLY, status: "ignored" };
  }

  await db.whatsAppInbound.update({
    where: { id: stored.id },
    data: {
      status: outcome.status,
      error: outcome.error ?? null,
      expenseId: outcome.expenseId ?? null,
      processedAt: new Date(),
    },
  });

  // A draft gets the Confirm / Edit / Discard buttons; anything else is a
  // plain reply.
  if (outcome.expenseId) {
    await provider.sendButtons(
      message.from,
      outcome.reply,
      captureButtons(stored.id)
    );
  } else {
    await provider.sendText(message.from, outcome.reply);
  }
}

/** Returns null when this exact message has already been stored. */
async function storeInbound(
  db: ReturnType<typeof scopedDb>,
  orgId: string,
  message: InboundMessage,
  userId: string
): Promise<{ id: string } | null> {
  try {
    return (await db.whatsAppInbound.create({
      data: {
        orgId,
        waMessageId: message.waMessageId,
        fromPhone: message.from,
        phoneNumberId: message.phoneNumberId,
        userId,
        messageType: message.type,
        text: message.text,
        mediaId: message.mediaId,
        payload: JSON.parse(JSON.stringify(message.raw ?? {})),
        status: "pending",
        receivedAt: message.receivedAt,
      },
      select: { id: true },
    })) as { id: string };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return null;
    throw e;
  }
}

/** Business number for a statuses-only webhook (no messages to read it from). */
function businessNumberOf(payload: unknown): string | null {
  const parsed = payload as {
    entry?: Array<{
      changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }>;
    }>;
  };
  for (const entry of parsed?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const id = change.value?.metadata?.phone_number_id;
      if (id) return id;
    }
  }
  return null;
}

/** Delivery receipt -> the outbound row we logged when sending. */
async function recordDeliveryStatus(
  db: ReturnType<typeof scopedDb>,
  status: DeliveryStatus
): Promise<void> {
  const mapped =
    status.status === "delivered"
      ? "delivered"
      : status.status === "read"
        ? "read"
        : status.status === "failed"
          ? "failed"
          : "sent";
  await db.whatsAppOutbound.updateMany({
    where: { waMessageId: status.waMessageId },
    data: {
      status: mapped,
      error: status.error,
      deliveredAt:
        mapped === "delivered" || mapped === "read" ? status.timestamp : undefined,
    },
  });
}

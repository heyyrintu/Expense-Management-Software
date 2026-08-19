// WhatsApp Cloud API webhook (PLAN 8.1).
//
// GET  — Meta's subscription handshake (hub.mode / hub.verify_token / hub.challenge).
// POST — inbound messages. Order of operations matters:
//   1. parse the payload only far enough to read metadata.phone_number_id
//   2. resolve THAT business number to an org (never the sender's number —
//      the same personal number may be linked in several orgs)
//   3. verify X-Hub-Signature-256 against that org's app secret
//   4. match the sender to a verified WhatsAppLink inside the org
//   5. persist to WhatsAppInbound for 8.2; unknown numbers get one canned,
//      rate-limited "link your number" reply and nothing is stored
//
// Meta retries on any non-200, so all soft failures answer 200.
import { NextResponse } from "next/server";
import { scopedDb } from "@/lib/db/scoped";
import { checkRateLimit } from "@/lib/rate-limit";
import { orgForPhoneNumberId } from "@/lib/whatsapp";
import { parseInbound } from "@/lib/whatsapp/meta";
import type { InboundMessage, WhatsAppProvider } from "@/lib/whatsapp/types";

export const runtime = "nodejs";

const NOT_LINKED_REPLY =
  "This number isn't linked to an expense account yet. Sign in to the expenses app, open your profile and add this WhatsApp number to get started.";

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
  if (messages.length === 0) {
    return NextResponse.json({ ok: true }); // delivery statuses, edits, etc.
  }

  // Every message in one webhook shares the receiving business number.
  const phoneNumberId = messages[0].phoneNumberId;
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
  if (!checkRateLimit("whatsappInbound", `${orgId}:${message.from}`)) {
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
    select: { userId: true, user: { select: { status: true } } },
  })) as { userId: string; user: { status: string } } | null;

  if (!link || link.user.status !== "active") {
    // One canned reply per number per window — never say whether the number
    // exists elsewhere, and store nothing.
    if (checkRateLimit("whatsappReply", `${orgId}:${message.from}`)) {
      await provider.sendText(message.from, NOT_LINKED_REPLY);
    }
    return;
  }

  // Persisted for 8.2 to turn into a draft expense. waMessageId is unique, so
  // Meta's at-least-once delivery cannot produce duplicates.
  try {
    await db.whatsAppInbound.create({
      data: {
        orgId,
        waMessageId: message.waMessageId,
        fromPhone: message.from,
        phoneNumberId: message.phoneNumberId,
        userId: link.userId,
        messageType: message.type,
        text: message.text,
        mediaId: message.mediaId,
        payload: JSON.parse(JSON.stringify(message.raw ?? {})),
        status: "pending",
        receivedAt: message.receivedAt,
      },
    });
  } catch (e) {
    // Unique violation = we already have it; anything else is worth logging.
    const code = (e as { code?: string }).code;
    if (code !== "P2002") throw e;
  }
}

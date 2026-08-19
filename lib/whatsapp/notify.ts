// WhatsApp notification dispatch (8.3).
//
// Rules that hold no matter which workflow calls this:
//   * WhatsApp is ADDITIVE — the in-app notification and email stub from 2.3
//     always happen; this is an extra channel, never a replacement. If the
//     channel is off, the user is opted out, or the number is unverified,
//     this function simply does nothing.
//   * Inside Meta's 24-hour window we send free-form text (and can attach
//     quick-reply buttons); outside it, only an approved template.
//   * Sends never throw into a workflow. Failures are logged to
//     WhatsAppOutbound with attempt counts and retried with backoff.
import type { ScopedDb } from "@/lib/db/scoped";
import { providerForOrg } from "./index";
import { backoffMs, shouldRetry, MAX_SEND_ATTEMPTS } from "./retry";
import {
  sendModeFor,
  type EventPayload,
  type WhatsAppEvent,
} from "./templates";
import type { SendResult, WhatsAppProvider } from "./types";

export type WhatsAppRecipient = { id: string; name: string };

type LinkRow = {
  userId: string;
  phoneE164: string;
  verifiedAt: Date | null;
  optedOut: boolean;
  lastInboundAt: Date | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send an event to one user. Returns true when the message was accepted by
 * WhatsApp; false for every "not applicable" case (channel off, opted out,
 * unverified) as well as for a genuine failure — callers must not branch on
 * it for correctness, only for logging.
 */
export async function notifyWhatsApp(
  db: ScopedDb,
  orgId: string,
  recipient: WhatsAppRecipient,
  event: WhatsAppEvent,
  payload: Omit<EventPayload, "recipientName">,
  opts?: {
    buttons?: Array<{ id: string; title: string }>;
    entity?: { type: string; id: string };
  }
): Promise<boolean> {
  try {
    const link = (await db.whatsAppLink.findUnique({
      where: { userId: recipient.id },
      select: {
        userId: true,
        phoneE164: true,
        verifiedAt: true,
        optedOut: true,
        lastInboundAt: true,
      },
    })) as LinkRow | null;

    // Not linked, not verified, or opted out — email + in-app already cover it.
    if (!link || !link.verifiedAt || link.optedOut) return false;

    const resolved = await providerForOrg(orgId);
    if (!resolved) return false; // channel disabled for this org

    const mode = sendModeFor(event, { ...payload, recipientName: recipient.name }, link.lastInboundAt);

    const log = (await db.whatsAppOutbound.create({
      data: {
        orgId,
        userId: recipient.id,
        toPhone: link.phoneE164,
        event,
        templateName: mode.kind === "template" ? mode.template.name : null,
        status: "queued",
        entityType: opts?.entity?.type ?? null,
        entityId: opts?.entity?.id ?? null,
      },
      select: { id: true },
    })) as { id: string };

    const result = await sendWithRetry(
      resolved.provider,
      link.phoneE164,
      mode,
      // Buttons need free-form; a template's buttons come from its own
      // approved definition, so they are only attached in-session.
      mode.kind === "free_form" ? opts?.buttons : undefined
    );

    await db.whatsAppOutbound.update({
      where: { id: log.id },
      data: result.ok
        ? {
            status: "sent",
            attempts: result.attempts,
            waMessageId: result.messageId || null,
            sentAt: new Date(),
          }
        : {
            status: "failed",
            attempts: result.attempts,
            error: result.error.slice(0, 500),
          },
    });

    if (!result.ok) {
      console.error(`[whatsapp] ${event} to ${recipient.id} failed:`, result.error);
    }
    return result.ok;
  } catch (e) {
    // A notification must never break the workflow that triggered it.
    console.error("[whatsapp] notify failed:", e);
    return false;
  }
}

type SendAttemptResult =
  | { ok: true; messageId: string; attempts: number }
  | { ok: false; error: string; attempts: number };

async function sendWithRetry(
  provider: WhatsAppProvider,
  to: string,
  mode: ReturnType<typeof sendModeFor>,
  buttons?: Array<{ id: string; title: string }>
): Promise<SendAttemptResult> {
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    let res: SendResult;
    if (mode.kind === "template") {
      res = await provider.sendTemplate(to, mode.template);
    } else if (buttons && buttons.length > 0) {
      res = await provider.sendButtons(to, mode.body, buttons);
    } else {
      res = await provider.sendText(to, mode.body);
    }

    if (res.ok) return { ok: true, messageId: res.messageId, attempts: attempt };
    lastError = res.error;
    if (!shouldRetry(attempt, res.error)) break;
    await sleep(backoffMs(attempt));
  }
  return { ok: false, error: lastError, attempts: MAX_SEND_ATTEMPTS };
}

/** Convenience for the common "one recipient, no buttons" case. */
export async function notifyWhatsAppMany(
  db: ScopedDb,
  orgId: string,
  recipients: WhatsAppRecipient[],
  event: WhatsAppEvent,
  payload: Omit<EventPayload, "recipientName">,
  opts?: { entity?: { type: string; id: string } }
): Promise<void> {
  for (const recipient of recipients) {
    await notifyWhatsApp(db, orgId, recipient, event, payload, opts);
  }
}

// notify(): create the in-app notification row (via the caller's scopedDb,
// so org stamping + RLS apply) and fire the email stub. Failures are
// swallowed — a lost notification must never fail a workflow action.
//
// 8.3: WhatsApp is fanned out from here too, so every event that already
// notified a user reaches their phone when they've linked one. It is strictly
// ADDITIVE — in-app and email always happen first, and a disabled channel,
// unverified number or opt-out simply means nothing more happens.
import type { ScopedDb } from "@/lib/db/scoped";
import { sendEmail } from "./email";
import {
  messageFor,
  type NotificationEvent,
} from "./messages";
import { notifyWhatsApp } from "@/lib/whatsapp/notify";
import type { WhatsAppEvent } from "@/lib/whatsapp/templates";

/** Events with a WhatsApp counterpart; the rest stay in-app + email only. */
const WHATSAPP_EVENT_MAP: Partial<Record<NotificationEvent, WhatsAppEvent>> = {
  "report.submitted": "report.submitted",
  "report.approved": "report.approved",
  "report.rejected": "report.rejected",
  "report.sent_back": "report.sent_back",
  "report.reimbursed": "payment.done",
};

export type NotifyPayload = {
  reportId: string;
  reportTitle: string;
  actorName?: string;
  reason?: string;
  totalFormatted?: string;
  /** payment reference / UTR — used by the payment_done template (8.3) */
  reference?: string;
};

export async function notify(
  db: ScopedDb,
  orgId: string,
  recipients: Array<{ id: string; email: string }>,
  event: NotificationEvent,
  payload: NotifyPayload,
  opts?: {
    /** Quick-reply buttons, only used inside the 24-hour session window. */
    whatsappButtons?: Array<{ id: string; title: string }>;
  }
): Promise<void> {
  const msg = messageFor(event, payload);
  for (const recipient of recipients) {
    try {
      await db.notification.create({
        data: {
          orgId,
          userId: recipient.id,
          type: msg.type,
          title: msg.title,
          body: msg.body,
          link: msg.link,
        },
      });
      await sendEmail({
        to: recipient.email,
        subject: msg.title,
        text: `${msg.body}\n\nOpen: ${msg.link}`,
      });
    } catch (e) {
      console.error("[notify] failed:", e);
    }

    // --- extra channel: WhatsApp (8.3) ---
    const waEvent = WHATSAPP_EVENT_MAP[event];
    if (!waEvent) continue;
    try {
      const user = (await db.user.findUnique({
        where: { id: recipient.id },
        select: { name: true },
      })) as { name: string } | null;
      if (!user) continue;
      await notifyWhatsApp(
        db,
        orgId,
        { id: recipient.id, name: user.name },
        waEvent,
        {
          reportTitle: payload.reportTitle,
          actorName: payload.actorName,
          reason: payload.reason,
          amountFormatted: payload.totalFormatted,
          reference: payload.reference,
          reportId: payload.reportId,
        },
        {
          buttons: opts?.whatsappButtons,
          entity: { type: "ExpenseReport", id: payload.reportId },
        }
      );
    } catch (e) {
      console.error("[notify] whatsapp fan-out failed:", e);
    }
  }
}

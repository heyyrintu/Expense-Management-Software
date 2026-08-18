// notify(): create the in-app notification row (via the caller's scopedDb,
// so org stamping + RLS apply) and fire the email stub. Failures are
// swallowed — a lost notification must never fail a workflow action.
import type { ScopedDb } from "@/lib/db/scoped";
import { sendEmail } from "./email";
import {
  messageFor,
  type NotificationEvent,
} from "./messages";

export async function notify(
  db: ScopedDb,
  orgId: string,
  recipients: Array<{ id: string; email: string }>,
  event: NotificationEvent,
  payload: {
    reportId: string;
    reportTitle: string;
    actorName?: string;
    reason?: string;
    totalFormatted?: string;
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
  }
}

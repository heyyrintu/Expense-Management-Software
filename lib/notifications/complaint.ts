// notify helper for complaints — in-app row + email stub, never fatal.
import type { ScopedDb } from "@/lib/db/scoped";
import { sendEmail } from "./email";
import {
  complaintMessageFor,
  type ComplaintNotificationEvent,
} from "./complaint-messages";
import type { ComplaintStatus, ComplaintType } from "@/lib/domain/complaint";

export async function notifyComplaint(
  db: ScopedDb,
  orgId: string,
  recipients: Array<{ id: string; email: string }>,
  event: ComplaintNotificationEvent,
  payload: {
    complaintId: string;
    complaintType: ComplaintType;
    status?: ComplaintStatus;
    actorName?: string;
    resolutionNote?: string | null;
  }
): Promise<void> {
  const msg = complaintMessageFor(event, payload);
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
      console.error("[notifyComplaint] failed:", e);
    }
  }
}

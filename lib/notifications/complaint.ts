// notify helper for complaints — in-app row + email stub, never fatal.
import type { ScopedDb } from "@/lib/db/scoped";
import { sendEmail } from "./email";
import {
  complaintMessageFor,
  type ComplaintNotificationEvent,
} from "./complaint-messages";
import {
  COMPLAINT_STATUS_LABELS,
  type ComplaintStatus,
  type ComplaintType,
} from "@/lib/domain/complaint";
import { notifyWhatsApp } from "@/lib/whatsapp/notify";

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

    // Status changes also reach the employee on WhatsApp when linked (8.3).
    if (event !== "complaint.status_changed") continue;
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
        "complaint.status_changed",
        {
          status: payload.status ? COMPLAINT_STATUS_LABELS[payload.status] : undefined,
          reason: payload.resolutionNote ?? undefined,
          complaintId: payload.complaintId,
        },
        { entity: { type: "Complaint", id: payload.complaintId } }
      );
    } catch (e) {
      console.error("[notifyComplaint] whatsapp fan-out failed:", e);
    }
  }
}

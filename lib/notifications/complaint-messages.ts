// Complaint notification copy (7.3) — pure, unit-tested.
import {
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_TYPE_LABELS,
  type ComplaintStatus,
  type ComplaintType,
} from "@/lib/domain/complaint";

export type ComplaintNotificationEvent =
  | "complaint.raised"
  | "complaint.assigned"
  | "complaint.status_changed"
  | "complaint.message";

export type ComplaintNotificationMessage = {
  type: ComplaintNotificationEvent;
  title: string;
  body: string;
  link: string;
};

export function complaintMessageFor(
  event: ComplaintNotificationEvent,
  p: {
    complaintId: string;
    complaintType: ComplaintType;
    status?: ComplaintStatus;
    actorName?: string;
    resolutionNote?: string | null;
  }
): ComplaintNotificationMessage {
  const link = `/complaints/${p.complaintId}`;
  const subject = COMPLAINT_TYPE_LABELS[p.complaintType].toLowerCase();
  switch (event) {
    case "complaint.raised":
      return {
        type: event,
        title: "New complaint raised",
        body: `${p.actorName ?? "An employee"} raised a complaint about ${subject}.`,
        link,
      };
    case "complaint.assigned":
      return {
        type: event,
        title: "A complaint was assigned to you",
        body: `You are now handling a complaint about ${subject}.`,
        link,
      };
    case "complaint.status_changed": {
      const status = p.status ? COMPLAINT_STATUS_LABELS[p.status] : "updated";
      return {
        type: event,
        title: `Your complaint is now ${status.toLowerCase()}`,
        body: `Your complaint about ${subject} was moved to ${status.toLowerCase()}${
          p.actorName ? ` by ${p.actorName}` : ""
        }${p.resolutionNote ? `: ${p.resolutionNote}` : "."}`,
        link,
      };
    }
    case "complaint.message":
      return {
        type: event,
        title: "New reply on a complaint",
        body: `${p.actorName ?? "Someone"} replied to the complaint about ${subject}.`,
        link,
      };
  }
}

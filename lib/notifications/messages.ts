// Pure notification copy — unit-tested in tests/unit/notification-messages.test.ts.
export type NotificationEvent =
  | "report.submitted"
  | "report.approved"
  | "report.approved_level1"
  | "report.rejected"
  | "report.sent_back"
  | "report.reimbursed";

export type NotificationMessage = {
  type: NotificationEvent;
  title: string;
  body: string;
  link: string;
};

export function messageFor(
  event: NotificationEvent,
  p: {
    reportId: string;
    reportTitle: string;
    actorName?: string;
    reason?: string;
    totalFormatted?: string;
  }
): NotificationMessage {
  switch (event) {
    case "report.submitted":
      return {
        type: event,
        title: `Report awaiting your approval`,
        body: `${p.actorName ?? "A teammate"} submitted “${p.reportTitle}”${p.totalFormatted ? ` (${p.totalFormatted})` : ""}.`,
        link: `/approvals/${p.reportId}`,
      };
    case "report.approved":
      return {
        type: event,
        title: `Report approved`,
        body: `“${p.reportTitle}” was approved${p.actorName ? ` by ${p.actorName}` : ""}. It now moves to reimbursement.`,
        link: `/reports/${p.reportId}`,
      };
    case "report.approved_level1":
      return {
        type: event,
        title: `Report needs a second approval`,
        body: `“${p.reportTitle}”${p.totalFormatted ? ` (${p.totalFormatted})` : ""} passed first approval and awaits finance sign-off.`,
        link: `/approvals/${p.reportId}`,
      };
    case "report.rejected":
      return {
        type: event,
        title: `Report rejected`,
        body: `“${p.reportTitle}” was rejected${p.actorName ? ` by ${p.actorName}` : ""}${p.reason ? `: ${p.reason}` : "."} Its expenses are back in your drafts.`,
        link: `/reports/${p.reportId}`,
      };
    case "report.sent_back":
      return {
        type: event,
        title: `Report sent back`,
        body: `“${p.reportTitle}” was sent back${p.actorName ? ` by ${p.actorName}` : ""}${p.reason ? `: ${p.reason}` : "."} Fix it up and resubmit.`,
        link: `/reports/${p.reportId}`,
      };
    case "report.reimbursed":
      return {
        type: event,
        title: `Reimbursement on its way`,
        body: `“${p.reportTitle}”${p.totalFormatted ? ` (${p.totalFormatted})` : ""} was marked reimbursed.`,
        link: `/reports/${p.reportId}`,
      };
  }
}

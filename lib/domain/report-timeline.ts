// Report status timeline (D2.3).
//
// Turns a report's state into the three steps §7.2 asks for —
// Submitted → Approved → Paid — with a timestamp on each.
//
// Pure, so the branching that actually matters (a rejection is not a step
// backwards, a partial payment is not "Paid") is unit-tested rather than
// reasoned about in JSX.
import type { ReportStatus } from "@/lib/domain/report-workflow";

export type TimelineState = "done" | "current" | "upcoming" | "stopped";

export type TimelineStep = {
  key: "submitted" | "approved" | "paid";
  label: string;
  state: TimelineState;
  at: Date | null;
  /** Replaces the label when the report stopped here (rejected, sent back). */
  note?: string;
};

export type ReportTimelineInput = {
  status: ReportStatus;
  submittedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
};

/**
 * The stepper's steps, in order.
 *
 * A REJECTED OR SENT-BACK REPORT DOES NOT REVERSE. It stops, and the step it
 * stopped at says why. Animating a stepper backwards would suggest the
 * submission was undone; it wasn't — it was answered, and the answer was no.
 * That distinction is the difference between "try again" and "start over".
 */
export function buildReportTimeline(input: ReportTimelineInput): TimelineStep[] {
  const { status, submittedAt, approvedAt, paidAt } = input;

  const rejected = status === "rejected";
  const sentBack = status === "sent_back";
  const stoppedEarly = rejected || sentBack;

  const paidDone = status === "reimbursed";
  // Partly paid is NOT paid. Showing the final step as done while money is
  // still owed is the one lie this component could tell that costs somebody
  // real money.
  const partlyPaid = status === "partially_reimbursed";
  const approvedDone = paidDone || partlyPaid || status === "approved";

  const submitted: TimelineStep = {
    key: "submitted",
    label: "Submitted",
    at: submittedAt,
    state: submittedAt ? "done" : status === "draft" ? "current" : "upcoming",
  };

  const approved: TimelineStep = {
    key: "approved",
    label: "Approved",
    at: approvedAt,
    state: stoppedEarly
      ? "stopped"
      : approvedDone
        ? "done"
        : status === "submitted"
          ? "current"
          : "upcoming",
    note: rejected ? "Rejected" : sentBack ? "Sent back" : undefined,
  };

  const paid: TimelineStep = {
    key: "paid",
    label: partlyPaid ? "Partly paid" : "Paid",
    at: paidAt,
    state: stoppedEarly
      ? "upcoming"
      : paidDone
        ? "done"
        : partlyPaid || status === "approved"
          ? "current"
          : "upcoming",
  };

  return [submitted, approved, paid];
}

/** Whether the timeline is worth showing at all — a draft has no history. */
export function hasTimeline(status: ReportStatus): boolean {
  return status !== "draft";
}

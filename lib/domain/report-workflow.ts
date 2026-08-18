// THE report state machine (CLAUDE.md): Draft → Submitted → Approved |
// Rejected | SentBack → Reimbursed. Transitions happen ONLY through this
// module; every transition writes an AuditLog row (enforced at the action
// layer, which must call nextStatus() before touching the database).
// Pure module — exhaustively tested in tests/unit/report-workflow.test.ts.
import { assertMinorUnits } from "@/lib/money";

export const REPORT_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "sent_back",
  "partially_reimbursed",
  "reimbursed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_ACTIONS = [
  "submit",
  "withdraw",
  "approve",
  "reject",
  "send_back",
  "reimburse",
  "reimburse_partial",
] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

const TRANSITIONS: Record<ReportStatus, Partial<Record<ReportAction, ReportStatus>>> = {
  draft: { submit: "submitted" },
  submitted: {
    withdraw: "draft", // employee withdraws before any decision (PRD 6.3)
    approve: "approved",
    reject: "rejected",
    send_back: "sent_back",
  },
  sent_back: { submit: "submitted" }, // employee fixes and resubmits
  approved: {
    reimburse: "reimbursed",
    reimburse_partial: "partially_reimbursed",
  },
  partially_reimbursed: {
    reimburse: "reimbursed", // final payment clears the balance
    reimburse_partial: "partially_reimbursed", // further partial payments
  },
  rejected: {}, // terminal
  reimbursed: {}, // terminal
};

/** The resulting status, or null when the transition is illegal. */
export function nextStatus(
  from: ReportStatus,
  action: ReportAction
): ReportStatus | null {
  return TRANSITIONS[from][action] ?? null;
}

/** Reject and send-back always need a written reason (PRD 6.4). */
export function requiresReason(action: ReportAction): boolean {
  return action === "reject" || action === "send_back";
}

/** Report contents (title, attached expenses) may change in these states. */
export function isReportEditable(status: ReportStatus): boolean {
  return status === "draft" || status === "sent_back";
}

/** Only never-submitted drafts may be hard-deleted. */
export function isReportDeletable(status: ReportStatus): boolean {
  return status === "draft";
}

/**
 * Expense status that mirrors a report status. sent_back and draft make the
 * expenses editable again (PRD 6.3 AC); rejected detaches — see
 * detachExpensesOnReject.
 */
export function expenseStatusFor(
  reportStatus: ReportStatus
): "draft" | "submitted" | "approved" | "rejected" | "reimbursed" {
  switch (reportStatus) {
    case "draft":
    case "sent_back":
      return "draft";
    case "submitted":
      return "submitted";
    case "approved":
    case "partially_reimbursed":
      return "approved"; // money still owed — expenses stay approved
    case "rejected":
      return "rejected";
    case "reimbursed":
      return "reimbursed";
  }
}

/**
 * On reject the report is terminal but the money is still owed to the
 * employee — expenses return to draft and detach so they can join a new
 * report. (Send-back keeps them attached: same report is fixed & resubmitted.)
 */
export function detachExpensesOnReject(): { status: "draft"; reportId: null } {
  return { status: "draft", reportId: null };
}

/** An approver can never approve their own report (CLAUDE.md). */
export function canActorDecide(reportOwnerId: string, actorId: string): boolean {
  return reportOwnerId !== actorId;
}

/** Report total = sum of attached expense amounts, integer minor units. */
export function computeReportTotal(amounts: number[]): number {
  let total = 0;
  for (const a of amounts) {
    assertMinorUnits(a);
    total += a;
  }
  assertMinorUnits(total);
  return total;
}

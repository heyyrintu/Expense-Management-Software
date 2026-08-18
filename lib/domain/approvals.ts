// Approval routing rules (task 2.2) — pure, unit-tested in
// tests/unit/approvals-domain.test.ts.
//
// Level 1: the submitter's assigned approver.
// Level 2 (only above the org threshold): any finance_admin+ who is neither
// the report owner nor the level-1 approver.
import { roleAtLeast, type Role } from "@/lib/auth/roles";
import { canActorDecide } from "@/lib/domain/report-workflow";

export type ApprovalRow = {
  level: number;
  action: "approved" | "rejected" | "sent_back";
  approverId: string;
  actedAt: Date;
};

/** How many approval levels this report needs. threshold null → single. */
export function requiredLevels(
  totalMinor: number,
  thresholdMinor: number | null
): 1 | 2 {
  if (thresholdMinor === null) return 1;
  return totalMinor > thresholdMinor ? 2 : 1;
}

/**
 * Approvals belonging to the CURRENT submission — a withdrawn/sent-back
 * report keeps its history, so only rows at/after the latest submittedAt
 * count toward the pending decision.
 */
export function currentSubmissionApprovals(
  approvals: ApprovalRow[],
  submittedAt: Date | null
): ApprovalRow[] {
  if (!submittedAt) return [];
  return approvals.filter((a) => a.actedAt.getTime() >= submittedAt.getTime());
}

/**
 * The next level awaiting a decision for a SUBMITTED report, or null when
 * all required levels have approved (i.e. the report should have
 * transitioned already).
 */
export function pendingLevel(
  current: ApprovalRow[],
  required: 1 | 2
): 1 | 2 | null {
  const l1 = current.find((a) => a.level === 1 && a.action === "approved");
  if (!l1) return 1;
  if (required === 2) {
    const l2 = current.find((a) => a.level === 2 && a.action === "approved");
    if (!l2) return 2;
  }
  return null;
}

export type ChainLevel2Input =
  | { type: "user"; userId: string }
  | { type: "finance" }
  | null;

export type EligibilityInput = {
  actorId: string;
  actorRole: Role;
  ownerId: string;
  /** who is RESPONSIBLE for level 1 (resolved chain; assigned approver by default) */
  responsibleLevel1Id: string | null;
  /** who actually APPROVED level 1 this submission (distinctness at level 2) */
  decidedLevel1Id: string | null;
  /** level-2 requirement from the resolved chain */
  level2: ChainLevel2Input;
  level: 1 | 2;
};

/** Whether the actor may decide at `level`. Self-approval is never allowed
 *  and the level-2 decider must differ from the level-1 one (5.4). */
export function canDecideAtLevel(input: EligibilityInput): boolean {
  if (!canActorDecide(input.ownerId, input.actorId)) return false;
  if (input.level === 1) {
    return (
      input.responsibleLevel1Id !== null &&
      input.actorId === input.responsibleLevel1Id
    );
  }
  if (input.level2 === null) return false;
  if (input.actorId === input.decidedLevel1Id) return false;
  if (input.level2.type === "user") {
    return (
      input.actorId === input.level2.userId &&
      roleAtLeast(input.actorRole, "approver")
    );
  }
  return roleAtLeast(input.actorRole, "finance_admin");
}

/** A report is flagged when any expense carries policy flags (3.x). */
export function isReportFlagged(expenseFlags: unknown[]): boolean {
  return expenseFlags.some(
    (f) => Array.isArray(f) && f.length > 0
  );
}

/**
 * Reason/justification requirements for a decision (3.2):
 * - reject / send_back always need a reason (PRD 6.4)
 * - approving a FLAGGED report needs a justification (PRD 6.5, logged)
 * Returns a user-facing error, or null when the decision may proceed.
 */
export function validateDecisionReason(
  action: "approve" | "reject" | "send_back",
  reportFlagged: boolean,
  reason: string | undefined
): string | null {
  const has = typeof reason === "string" && reason.trim().length > 0;
  if (action !== "approve") {
    return has ? null : "A reason is required.";
  }
  if (reportFlagged && !has) {
    return "This report has policy flags — add a justification to approve.";
  }
  return null;
}

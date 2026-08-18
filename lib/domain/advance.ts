// Cash-advance state machine + settlement math (PLAN 6.2) — pure,
// unit-tested in tests/unit/advance.test.ts.
import { assertMinorUnits } from "@/lib/money";
import { canActorDecide } from "@/lib/domain/report-workflow";

export const ADVANCE_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "disbursed",
  "partially_settled",
  "settled",
] as const;
export type AdvanceStatus = (typeof ADVANCE_STATUSES)[number];

export const ADVANCE_ACTIONS = [
  "submit",
  "approve",
  "reject",
  "disburse",
  "settle_partial",
  "settle_full",
] as const;
export type AdvanceAction = (typeof ADVANCE_ACTIONS)[number];

const TRANSITIONS: Record<AdvanceStatus, Partial<Record<AdvanceAction, AdvanceStatus>>> = {
  draft: { submit: "submitted" },
  submitted: { approve: "approved", reject: "rejected" },
  approved: { disburse: "disbursed" },
  disbursed: {
    settle_partial: "partially_settled",
    settle_full: "settled",
  },
  partially_settled: {
    settle_partial: "partially_settled",
    settle_full: "settled",
  },
  rejected: {}, // terminal
  settled: {}, // terminal
};

export function nextAdvanceStatus(
  from: AdvanceStatus,
  action: AdvanceAction
): AdvanceStatus | null {
  return TRANSITIONS[from][action] ?? null;
}

/** Only the owner's assigned approver may decide; never the owner (reused
 *  routing rule from reports, PRD 6.2 spec). */
export function canDecideAdvance(input: {
  actorId: string;
  ownerId: string;
  ownerApproverId: string | null;
}): boolean {
  if (!canActorDecide(input.ownerId, input.actorId)) return false;
  return (
    input.ownerApproverId !== null && input.actorId === input.ownerApproverId
  );
}

/** Advances that can absorb settlements. */
export const OPEN_ADVANCE_STATUSES = ["disbursed", "partially_settled"] as const;

export function outstandingAdvance(amount: number, settledAmount: number): number {
  assertMinorUnits(amount);
  assertMinorUnits(settledAmount);
  return Math.max(0, amount - settledAmount);
}

export type OpenAdvance = {
  id: string;
  amount: number;
  settledAmount: number;
};

export type SettlementAllocation = {
  advanceId: string;
  amount: number;
  /** the advance's status after this allocation */
  newStatus: "partially_settled" | "settled";
  newSettledAmount: number;
};

/**
 * Offset a reimbursed amount against open advances OLDEST FIRST.
 * Returns per-advance allocations and the remainder that is actually
 * payable to the employee in cash.
 */
export function allocateSettlement(
  reimbursedAmount: number,
  openAdvancesOldestFirst: OpenAdvance[]
): { allocations: SettlementAllocation[]; remainder: number } {
  assertMinorUnits(reimbursedAmount);
  let remaining = reimbursedAmount;
  const allocations: SettlementAllocation[] = [];

  for (const adv of openAdvancesOldestFirst) {
    if (remaining <= 0) break;
    const outstanding = outstandingAdvance(adv.amount, adv.settledAmount);
    if (outstanding <= 0) continue;
    const applied = Math.min(remaining, outstanding);
    const newSettledAmount = adv.settledAmount + applied;
    allocations.push({
      advanceId: adv.id,
      amount: applied,
      newSettledAmount,
      newStatus: newSettledAmount >= adv.amount ? "settled" : "partially_settled",
    });
    remaining -= applied;
  }
  return { allocations, remainder: remaining };
}

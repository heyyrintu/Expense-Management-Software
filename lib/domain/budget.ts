// Budget rules (PLAN 5.1) — pure, unit-tested in tests/unit/budget.test.ts.
import { assertMinorUnits } from "@/lib/money";

export type BudgetPeriod = "monthly" | "quarterly" | "yearly";
export type BudgetScopeType = "department" | "project" | "category";

/** "Spent" counts money that has left draft and wasn't rejected. */
export const SPENT_STATUSES = ["submitted", "approved", "reimbursed"] as const;

/** UTC window [start, end) of the period containing `now`. */
export function periodWindow(
  period: BudgetPeriod,
  now: Date
): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (period) {
    case "monthly":
      return {
        start: new Date(Date.UTC(y, m, 1)),
        end: new Date(Date.UTC(y, m + 1, 1)),
      };
    case "quarterly": {
      const q = Math.floor(m / 3) * 3;
      return {
        start: new Date(Date.UTC(y, q, 1)),
        end: new Date(Date.UTC(y, q + 3, 1)),
      };
    }
    case "yearly":
      return {
        start: new Date(Date.UTC(y, 0, 1)),
        end: new Date(Date.UTC(y + 1, 0, 1)),
      };
  }
}

/** Utilization percent (integer, floors; 100+ means over budget). */
export function utilizationPct(spent: number, amount: number): number {
  assertMinorUnits(spent);
  assertMinorUnits(amount);
  if (amount <= 0) return 0;
  return Math.floor((spent / amount) * 100);
}

export type AlertLevel = "ok" | "warn" | "over";

/** Visual level: amber at ≥80%, red at ≥100%. */
export function alertLevel(pct: number): AlertLevel {
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "ok";
}

/**
 * Which alert thresholds a spend change crosses (for notifications):
 * fires each of 80 / 100 exactly when before was below and after is at or
 * beyond it.
 */
export function crossedThresholds(
  before: number,
  after: number,
  amount: number
): Array<80 | 100> {
  if (amount <= 0 || after <= before) return [];
  const crossed: Array<80 | 100> = [];
  for (const t of [80, 100] as const) {
    const bound = (amount * t) / 100;
    if (before < bound && after >= bound) crossed.push(t);
  }
  return crossed;
}

export type BudgetExpense = {
  amount: number;
  date: Date;
  categoryId: string;
  projectId: string | null;
  ownerDepartmentId: string | null;
};

/** Does this expense count toward the given budget scope? */
export function inBudgetScope(
  e: BudgetExpense,
  scopeType: BudgetScopeType,
  scopeId: string
): boolean {
  switch (scopeType) {
    case "category":
      return e.categoryId === scopeId;
    case "project":
      return e.projectId === scopeId;
    case "department":
      return e.ownerDepartmentId === scopeId;
  }
}

/** Sum of expenses inside the scope AND the period window. */
export function contribution(
  expenses: BudgetExpense[],
  scopeType: BudgetScopeType,
  scopeId: string,
  window: { start: Date; end: Date }
): number {
  let total = 0;
  for (const e of expenses) {
    if (
      inBudgetScope(e, scopeType, scopeId) &&
      e.date.getTime() >= window.start.getTime() &&
      e.date.getTime() < window.end.getTime()
    ) {
      assertMinorUnits(e.amount);
      total += e.amount;
    }
  }
  return total;
}

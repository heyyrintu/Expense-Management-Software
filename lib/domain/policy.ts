// Policy rule engine (PLAN 3.1, PRD 6.5) — PURE. Violations flag, never
// block; an approver may approve flagged reports with a justification.
// Exhaustively unit-tested in tests/unit/policy.test.ts.
import { policyMessages } from "@/lib/errors";

export type PolicyRule =
  | "per_expense_limit"
  | "monthly_limit"
  | "receipt_required"
  | "expense_age"
  | "duplicate";

export type PolicyFlag = {
  rule: PolicyRule;
  message: string;
};

export type ExpenseForPolicy = {
  /** minor units in the ORG BASE currency — limits compare against this (6.4) */
  baseAmount: number;
  /** minor units in the ORIGINAL currency — duplicate detection uses this */
  originalAmount: number;
  /** calendar date of the expense (UTC midnight) */
  date: Date;
  merchant: string;
  receiptCount: number;
  /**
   * Expense type. Only the receipt rule reads it — see RECEIPT_EXEMPT_TYPES.
   * Optional so existing call sites keep compiling and default to `regular`,
   * which is the conservative reading: an unknown type still needs a receipt.
   */
  type?: ExpenseTypeForPolicy;
};

export type ExpenseTypeForPolicy = "regular" | "mileage" | "per_diem";

/**
 * Types the receipt-required rule does not apply to — EXPLICIT, not implicit.
 *
 * A per-diem is an allowance the organisation pays by its own published rate.
 * There is no vendor, no transaction and therefore no receipt in existence;
 * flagging one for a missing receipt would ask the employee for a document
 * that cannot be obtained, on every single claim. The flag would fire so
 * reliably that approvers would learn to ignore the flag column — which costs
 * more than the rule was ever worth.
 *
 * Mileage is here for the same reason and was previously exempt only by
 * accident: nothing set `receiptRequiredAbove` on mileage categories, so the
 * rule never fired. That is a configuration coincidence, not a decision, and
 * it would have started flagging the day someone set a threshold on the
 * category a mileage claim happened to use.
 *
 * EVERY OTHER RULE STILL APPLIES. Per-expense and monthly limits catch an
 * inflated claim; duplicate detection catches the same trip filed twice —
 * which matters MORE for per-diem than for a receipted expense, because there
 * is no receipt to notice you have already seen.
 */
const RECEIPT_EXEMPT_TYPES: ReadonlySet<ExpenseTypeForPolicy> = new Set([
  "per_diem",
  "mileage",
]);

/** Whether the receipt-required rule applies to an expense of this type. */
export function requiresReceipt(type: ExpenseTypeForPolicy = "regular"): boolean {
  return !RECEIPT_EXEMPT_TYPES.has(type);
}

export type CategoryLimits = {
  perExpenseLimit: number | null;
  monthlyLimit: number | null;
  receiptRequiredAbove: number | null;
};

export type DuplicateCandidate = {
  amount: number;
  date: Date;
  merchant: string;
};

export type PolicyContext = {
  category: CategoryLimits | null;
  /** user's spend (minor units) in this category in the expense's month,
   *  EXCLUDING the expense being evaluated */
  monthlySpent: number;
  /** other expenses of the SAME user (self excluded) to test duplicates */
  duplicateCandidates: DuplicateCandidate[];
  /** flag expenses older than this many days; null disables the rule */
  maxAgeDays: number | null;
  /** evaluation moment (injected for testability) */
  now: Date;
  /** minor units → display string, org currency */
  formatAmount: (minor: number) => string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Duplicate probe (CLAUDE.md): same amount + date + merchant, merchant
 *  compared case-insensitively (org+user scoping happens at the query). */
export function isDuplicateOf(
  expense: Pick<ExpenseForPolicy, "originalAmount" | "date" | "merchant">,
  candidate: DuplicateCandidate
): boolean {
  return (
    candidate.amount === expense.originalAmount &&
    sameCalendarDay(candidate.date, expense.date) &&
    candidate.merchant.trim().toLowerCase() ===
      expense.merchant.trim().toLowerCase()
  );
}

export function evaluateExpense(
  expense: ExpenseForPolicy,
  ctx: PolicyContext
): PolicyFlag[] {
  const flags: PolicyFlag[] = [];
  const cat = ctx.category;

  if (cat?.perExpenseLimit != null && expense.baseAmount > cat.perExpenseLimit) {
    flags.push({
      rule: "per_expense_limit",
      message: policyMessages.per_expense_limit(
        ctx.formatAmount(cat.perExpenseLimit)
      ),
    });
  }

  if (
    cat?.monthlyLimit != null &&
    ctx.monthlySpent + expense.baseAmount > cat.monthlyLimit
  ) {
    flags.push({
      rule: "monthly_limit",
      message: policyMessages.monthly_limit(ctx.formatAmount(cat.monthlyLimit)),
    });
  }

  // `requiresReceipt` first, and deliberately not folded into the condition
  // below as an anonymous `expense.type !== "per_diem"`: the exemption is a
  // policy decision with a written reason, and it should be greppable by name
  // from anywhere it is questioned.
  if (
    requiresReceipt(expense.type) &&
    cat?.receiptRequiredAbove != null &&
    expense.baseAmount > cat.receiptRequiredAbove &&
    expense.receiptCount === 0
  ) {
    flags.push({
      rule: "receipt_required",
      message: policyMessages.receipt_required(
        ctx.formatAmount(cat.receiptRequiredAbove)
      ),
    });
  }

  if (ctx.maxAgeDays != null && ctx.maxAgeDays > 0) {
    const ageDays = Math.floor(
      (ctx.now.getTime() - expense.date.getTime()) / MS_PER_DAY
    );
    if (ageDays > ctx.maxAgeDays) {
      flags.push({
        rule: "expense_age",
        message: policyMessages.expense_age(ctx.maxAgeDays),
      });
    }
  }

  if (ctx.duplicateCandidates.some((c) => isDuplicateOf(expense, c))) {
    flags.push({
      rule: "duplicate",
      message: policyMessages.duplicate(expense.merchant),
    });
  }

  return flags;
}

/** UTC month window [start, next month start) for the expense's date. */
export function monthWindow(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

export type SplitForPolicy = {
  amount: number;
  categoryId: string;
};

export type SplitCategoryContext = {
  limits: CategoryLimits | null;
  /** user's spend in this category this month, excluding this expense */
  monthlySpent: number;
  categoryName: string;
};

/**
 * Per-split limit checks (6.3): each split is evaluated against ITS OWN
 * category's per-expense and monthly limits. Receipt/age/duplicate rules
 * stay at the expense level.
 */
export function evaluateSplitLimits(
  splits: SplitForPolicy[],
  contextByCategory: Map<string, SplitCategoryContext>,
  formatAmount: (minor: number) => string
): PolicyFlag[] {
  const flags: PolicyFlag[] = [];
  // aggregate split amounts per category first (two splits may share one)
  const perCategory = new Map<string, number>();
  for (const s of splits) {
    perCategory.set(s.categoryId, (perCategory.get(s.categoryId) ?? 0) + s.amount);
  }
  for (const [categoryId, amount] of perCategory) {
    const ctx = contextByCategory.get(categoryId);
    if (!ctx?.limits) continue;
    if (ctx.limits.perExpenseLimit != null && amount > ctx.limits.perExpenseLimit) {
      flags.push({
        rule: "per_expense_limit",
        message: `${ctx.categoryName}: ${policyMessages.per_expense_limit(formatAmount(ctx.limits.perExpenseLimit))}`,
      });
    }
    if (
      ctx.limits.monthlyLimit != null &&
      ctx.monthlySpent + amount > ctx.limits.monthlyLimit
    ) {
      flags.push({
        rule: "monthly_limit",
        message: `${ctx.categoryName}: ${policyMessages.monthly_limit(formatAmount(ctx.limits.monthlyLimit))}`,
      });
    }
  }
  return flags;
}

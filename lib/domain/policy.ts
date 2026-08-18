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
  /** minor units */
  amount: number;
  /** calendar date of the expense (UTC midnight) */
  date: Date;
  merchant: string;
  receiptCount: number;
};

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
  expense: Pick<ExpenseForPolicy, "amount" | "date" | "merchant">,
  candidate: DuplicateCandidate
): boolean {
  return (
    candidate.amount === expense.amount &&
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

  if (cat?.perExpenseLimit != null && expense.amount > cat.perExpenseLimit) {
    flags.push({
      rule: "per_expense_limit",
      message: policyMessages.per_expense_limit(
        ctx.formatAmount(cat.perExpenseLimit)
      ),
    });
  }

  if (
    cat?.monthlyLimit != null &&
    ctx.monthlySpent + expense.amount > cat.monthlyLimit
  ) {
    flags.push({
      rule: "monthly_limit",
      message: policyMessages.monthly_limit(ctx.formatAmount(cat.monthlyLimit)),
    });
  }

  if (
    cat?.receiptRequiredAbove != null &&
    expense.amount > cat.receiptRequiredAbove &&
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

// Gathers policy context via scopedDb and evaluates the pure engine.
// Called on expense create/update and when receipts change.
import { expenseAgeLimitDays } from "@/lib/domain/org-settings";
import {
  evaluateExpense,
  evaluateSplitLimits,
  monthWindow,
  type PolicyFlag,
  type SplitCategoryContext,
  type SplitForPolicy,
} from "@/lib/domain/policy";
import type { ScopedDb } from "@/lib/db/scoped";
import { convertToBase, formatMoney } from "@/lib/money";

export type EvalInput = {
  /** exclude this expense from monthly + duplicate context (updates) */
  expenseId: string | null;
  userId: string;
  /** ORIGINAL-currency minor units (duplicate probe) */
  amount: number;
  /** ORG-BASE minor units (limits, 6.4) */
  baseAmount: number;
  date: Date;
  merchant: string;
  categoryId: string;
  receiptCount: number;
  /** 6.3: when present, per-category limits run PER SPLIT (base amounts) */
  splits?: SplitForPolicy[];
};

export async function computeExpenseFlags(
  db: ScopedDb,
  orgId: string,
  input: EvalInput
): Promise<PolicyFlag[]> {
  const [org, category] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    db.category.findUnique({
      where: { id: input.categoryId },
      select: {
        perExpenseLimit: true,
        monthlyLimit: true,
        receiptRequiredAbove: true,
      },
    }),
  ]);

  const { start, end } = monthWindow(input.date);
  const [monthlyAgg, duplicateCandidates] = await Promise.all([
    db.expense.aggregate({
      where: {
        userId: input.userId,
        categoryId: input.categoryId,
        date: { gte: start, lt: end },
        ...(input.expenseId ? { id: { not: input.expenseId } } : {}),
      },
      _sum: { baseAmount: true },
    }),
    input.merchant.trim() === ""
      ? Promise.resolve([])
      : db.expense.findMany({
          where: {
            userId: input.userId,
            amount: input.amount,
            date: input.date,
            merchant: { equals: input.merchant, mode: "insensitive" },
            ...(input.expenseId ? { id: { not: input.expenseId } } : {}),
          },
          select: { amount: true, date: true, merchant: true },
          take: 5,
        }),
  ]);

  const fmt = (minor: number) => formatMoney(minor, org.currency);
  const hasSplits = (input.splits?.length ?? 0) > 0;

  const baseFlags = evaluateExpense(
    {
      baseAmount: input.baseAmount,
      originalAmount: input.amount,
      date: input.date,
      merchant: input.merchant,
      receiptCount: input.receiptCount,
    },
    {
      // with splits, per-category limits run per split below
      category: hasSplits ? null : category,
      monthlySpent: monthlyAgg._sum.baseAmount ?? 0,
      duplicateCandidates,
      maxAgeDays: expenseAgeLimitDays(org.settings),
      now: new Date(),
      formatAmount: fmt,
    }
  );
  // receipt-required stays expense-level even when split — use the primary category
  if (
    hasSplits &&
    category?.receiptRequiredAbove != null &&
    input.baseAmount > category.receiptRequiredAbove &&
    input.receiptCount === 0
  ) {
    baseFlags.push({
      rule: "receipt_required",
      message: `A receipt is required for amounts above ${fmt(category.receiptRequiredAbove)}.`,
    });
  }
  if (!hasSplits) return baseFlags;

  const splitCategoryIds = [...new Set(input.splits!.map((s) => s.categoryId))];
  const { start: ws, end: we } = monthWindow(input.date);
  const ctxByCategory = new Map<string, SplitCategoryContext>();
  for (const categoryId of splitCategoryIds) {
    const [cat, agg] = await Promise.all([
      db.category.findUnique({
        where: { id: categoryId },
        select: {
          name: true,
          perExpenseLimit: true,
          monthlyLimit: true,
          receiptRequiredAbove: true,
        },
      }),
      db.expense.aggregate({
        where: {
          userId: input.userId,
          categoryId,
          date: { gte: ws, lt: we },
          ...(input.expenseId ? { id: { not: input.expenseId } } : {}),
        },
        _sum: { baseAmount: true },
      }),
    ]);
    if (cat) {
      ctxByCategory.set(categoryId, {
        limits: {
          perExpenseLimit: cat.perExpenseLimit,
          monthlyLimit: cat.monthlyLimit,
          receiptRequiredAbove: cat.receiptRequiredAbove,
        },
        monthlySpent: agg._sum.baseAmount ?? 0,
        categoryName: cat.name,
      });
    }
  }
  return [
    ...baseFlags,
    ...evaluateSplitLimits(input.splits!, ctxByCategory, fmt),
  ];
}

/** Recompute + persist flags for an existing expense (receipt changes). */
export async function refreshExpenseFlags(
  db: ScopedDb,
  orgId: string,
  expenseId: string
): Promise<void> {
  const expense = await db.expense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      userId: true,
      amount: true,
      baseAmount: true,
      fxRate: true,
      date: true,
      merchant: true,
      categoryId: true,
      splits: { select: { categoryId: true, amount: true } },
      _count: { select: { receipts: true } },
    },
  });
  if (!expense) return;
  const flags = await computeExpenseFlags(db, orgId, {
    expenseId: expense.id,
    userId: expense.userId,
    amount: expense.amount,
    baseAmount: expense.baseAmount,
    date: expense.date,
    merchant: expense.merchant,
    categoryId: expense.categoryId,
    receiptCount: expense._count.receipts,
    splits: expense.splits.map((sp: { categoryId: string; amount: number }) => ({
      categoryId: sp.categoryId,
      amount: convertToBase(sp.amount, expense.fxRate) ?? sp.amount,
    })),
  });
  await db.expense.update({
    where: { id: expense.id },
    data: { flags },
  });
}

// Gathers policy context via scopedDb and evaluates the pure engine.
// Called on expense create/update and when receipts change.
import { expenseAgeLimitDays } from "@/lib/domain/org-settings";
import {
  evaluateExpense,
  monthWindow,
  type PolicyFlag,
} from "@/lib/domain/policy";
import type { ScopedDb } from "@/lib/db/scoped";
import { formatMoney } from "@/lib/money";

export type EvalInput = {
  /** exclude this expense from monthly + duplicate context (updates) */
  expenseId: string | null;
  userId: string;
  amount: number;
  date: Date;
  merchant: string;
  categoryId: string;
  receiptCount: number;
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
      _sum: { amount: true },
    }),
    db.expense.findMany({
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

  return evaluateExpense(
    {
      amount: input.amount,
      date: input.date,
      merchant: input.merchant,
      receiptCount: input.receiptCount,
    },
    {
      category,
      monthlySpent: monthlyAgg._sum.amount ?? 0,
      duplicateCandidates,
      maxAgeDays: expenseAgeLimitDays(org.settings),
      now: new Date(),
      formatAmount: (minor) => formatMoney(minor, org.currency),
    }
  );
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
      date: true,
      merchant: true,
      categoryId: true,
      _count: { select: { receipts: true } },
    },
  });
  if (!expense) return;
  const flags = await computeExpenseFlags(db, orgId, {
    expenseId: expense.id,
    userId: expense.userId,
    amount: expense.amount,
    date: expense.date,
    merchant: expense.merchant,
    categoryId: expense.categoryId,
    receiptCount: expense._count.receipts,
  });
  await db.expense.update({
    where: { id: expense.id },
    data: { flags },
  });
}

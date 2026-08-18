// Budget vs actual (6.7) — the SAME computation /budgets renders, extracted
// so the analytics page and budgets page cannot disagree.
import {
  alertLevel,
  periodWindow,
  utilizationPct,
  SPENT_STATUSES,
  type AlertLevel,
  type BudgetPeriod,
  type BudgetScopeType,
} from "@/lib/domain/budget";
import type { ScopedDb } from "@/lib/db/scoped";

export type BudgetUtilization = {
  id: string;
  scopeType: BudgetScopeType;
  scopeId: string;
  period: BudgetPeriod;
  amount: number;
  spent: number;
  pct: number;
  level: AlertLevel;
};

export async function computeBudgetUtilization(
  db: ScopedDb,
  now: Date
): Promise<BudgetUtilization[]> {
  const budgets = (await db.budget.findMany({ orderBy: { createdAt: "asc" } })) as Array<{
    id: string;
    scopeType: BudgetScopeType;
    scopeId: string;
    period: BudgetPeriod;
    amount: number;
  }>;
  const out: BudgetUtilization[] = [];
  for (const b of budgets) {
    const window = periodWindow(b.period, now);
    const where =
      b.scopeType === "department"
        ? { user: { departmentId: b.scopeId } }
        : b.scopeType === "category"
          ? { categoryId: b.scopeId }
          : { projectId: b.scopeId };
    const agg = await db.expense.aggregate({
      where: {
        status: { in: [...SPENT_STATUSES] },
        date: { gte: window.start, lt: window.end },
        ...where,
      },
      _sum: { baseAmount: true },
    });
    const spent = agg._sum.baseAmount ?? 0;
    const pct = utilizationPct(spent, b.amount);
    out.push({ ...b, spent, pct, level: alertLevel(pct) });
  }
  return out;
}

// Analytics module (PLAN 6.7): ONE shared fetch + pure aggregations feed the
// /analytics widgets, the drill-down views, and the monthly summary email —
// no duplicated SQL, so every number reconciles by construction.
// "Spend" here = submitted/approved/reimbursed expenses in ORG BASE minor
// units (same definition as budgets, 5.1/6.4).
import { SPENT_STATUSES } from "@/lib/domain/budget";
import type { ScopedDb } from "@/lib/db/scoped";

export type AnalyticsRow = {
  id: string;
  baseAmount: number;
  date: Date;
  status: string;
  merchant: string;
  flags: unknown;
  userId: string;
  userName: string;
  categoryId: string;
  categoryName: string;
  departmentId: string | null;
  departmentName: string | null;
  projectId: string | null;
  projectName: string | null;
};

/** The one org-scoped fetch every 6.7 surface uses. */
export async function fetchSpendRows(
  db: ScopedDb,
  window: { start: Date; end: Date }
): Promise<AnalyticsRow[]> {
  const rows = (await db.expense.findMany({
    where: {
      status: { in: [...SPENT_STATUSES] },
      date: { gte: window.start, lt: window.end },
    },
    select: {
      id: true,
      baseAmount: true,
      date: true,
      status: true,
      merchant: true,
      flags: true,
      userId: true,
      categoryId: true,
      projectId: true,
      user: { select: { name: true, departmentId: true, department: { select: { name: true } } } },
      category: { select: { name: true } },
      project: { select: { name: true } },
    },
  })) as Array<{
    id: string;
    baseAmount: number;
    date: Date;
    status: string;
    merchant: string;
    flags: unknown;
    userId: string;
    categoryId: string;
    projectId: string | null;
    user: { name: string; departmentId: string | null; department: { name: string } | null };
    category: { name: string };
    project: { name: string } | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    baseAmount: r.baseAmount,
    date: r.date,
    status: r.status,
    merchant: r.merchant,
    flags: r.flags,
    userId: r.userId,
    userName: r.user.name,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    departmentId: r.user.departmentId,
    departmentName: r.user.department?.name ?? null,
    projectId: r.projectId,
    projectName: r.project?.name ?? null,
  }));
}

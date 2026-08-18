// Budget threshold alerts (5.1): when a report submission pushes a budget
// past 80% or 100%, notify finance admins. Never throws — a failed alert
// must not fail the submission.
import {
  contribution,
  crossedThresholds,
  periodWindow,
  SPENT_STATUSES,
  type BudgetExpense,
  type BudgetPeriod,
  type BudgetScopeType,
} from "@/lib/domain/budget";
import type { ScopedDb } from "@/lib/db/scoped";
import { formatMoney } from "@/lib/money";
import { sendEmail } from "@/lib/notifications/email";

type BudgetRow = {
  id: string;
  scopeType: BudgetScopeType;
  scopeId: string;
  period: BudgetPeriod;
  amount: number;
};

export async function checkBudgetAlertsAfterSubmit(
  db: ScopedDb,
  orgId: string,
  reportId: string
): Promise<void> {
  try {
    const budgets = (await db.budget.findMany()) as BudgetRow[];
    if (budgets.length === 0) return;

    const reportExpenses = (await db.expense.findMany({
      where: { reportId },
      select: {
        baseAmount: true,
        date: true,
        categoryId: true,
        projectId: true,
        user: { select: { departmentId: true } },
      },
    })) as Array<{
      baseAmount: number;
      date: Date;
      categoryId: string;
      projectId: string | null;
      user: { departmentId: string | null };
    }>;
    const submitted: BudgetExpense[] = reportExpenses.map((e) => ({
      amount: e.baseAmount,
      date: e.date,
      categoryId: e.categoryId,
      projectId: e.projectId,
      ownerDepartmentId: e.user.departmentId,
    }));

    const now = new Date();
    const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
    let admins: Array<{ id: string; email: string }> | null = null;

    const names = {
      department: async (id: string) =>
        (await db.department.findUnique({ where: { id } }))?.name ?? "department",
      project: async (id: string) =>
        (await db.project.findUnique({ where: { id } }))?.name ?? "project",
      category: async (id: string) =>
        (await db.category.findUnique({ where: { id } }))?.name ?? "category",
    };

    for (const budget of budgets) {
      const window = periodWindow(budget.period, now);
      const delta = contribution(submitted, budget.scopeType, budget.scopeId, window);
      if (delta === 0) continue;

      // spend AFTER this submission (expenses are already status=submitted)
      const where =
        budget.scopeType === "department"
          ? { user: { departmentId: budget.scopeId } }
          : budget.scopeType === "category"
            ? { categoryId: budget.scopeId }
            : { projectId: budget.scopeId };
      const agg = await db.expense.aggregate({
        where: {
          status: { in: [...SPENT_STATUSES] },
          date: { gte: window.start, lt: window.end },
          ...where,
        },
        _sum: { baseAmount: true },
      });
      const after = agg._sum.baseAmount ?? 0;
      const before = after - delta;

      const crossed = crossedThresholds(before, after, budget.amount);
      if (crossed.length === 0) continue;

      admins ??= (await db.user.findMany({
        where: { status: "active", role: { in: ["finance_admin", "org_admin"] } },
        select: { id: true, email: true },
      })) as Array<{ id: string; email: string }>;
      const label = await names[budget.scopeType](budget.scopeId);
      const worst = crossed.includes(100) ? 100 : 80;
      const title =
        worst === 100
          ? `Budget exceeded: ${label}`
          : `Budget at 80%: ${label}`;
      const body = `${label} (${budget.scopeType}, ${budget.period}) is at ${formatMoney(after, org.currency)} of ${formatMoney(budget.amount, org.currency)}.`;

      for (const admin of admins) {
        await db.notification.create({
          data: {
            orgId,
            userId: admin.id,
            type: worst === 100 ? "budget.exceeded" : "budget.warning",
            title,
            body,
            link: "/budgets",
          },
        });
        await sendEmail({ to: admin.email, subject: title, text: `${body}\n\nOpen: /budgets` });
      }
    }
  } catch (e) {
    console.error("[budget-alerts] failed:", e);
  }
}

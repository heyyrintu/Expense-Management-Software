import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guard";
import {
  alertLevel,
  periodWindow,
  utilizationPct,
  SPENT_STATUSES,
  type BudgetPeriod,
  type BudgetScopeType,
} from "@/lib/domain/budget";
import { scopedDb } from "@/lib/db/scoped";
import { formatMoney } from "@/lib/money";
import { BudgetsPanel, type BudgetView } from "./budgets-panel";

type BudgetRow = {
  id: string;
  scopeType: BudgetScopeType;
  scopeId: string;
  period: BudgetPeriod;
  amount: number;
};

export default async function BudgetsPage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const [org, budgets, departments, projects, categories] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.budget.findMany({ orderBy: { createdAt: "asc" } }) as Promise<BudgetRow[]>,
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const names = {
    department: new Map<string, string>(departments.map((d: { id: string; name: string }) => [d.id, d.name])),
    project: new Map<string, string>(projects.map((p: { id: string; name: string }) => [p.id, p.name])),
    category: new Map<string, string>(categories.map((c: { id: string; name: string }) => [c.id, c.name])),
  };

  const now = new Date();
  const views: BudgetView[] = [];
  for (const b of budgets) {
    const window = periodWindow(b.period, now);
    let spent = 0;
    if (b.scopeType === "department") {
      const agg = await db.expense.aggregate({
        where: {
          status: { in: [...SPENT_STATUSES] },
          date: { gte: window.start, lt: window.end },
          user: { departmentId: b.scopeId },
        },
        _sum: { amount: true },
      });
      spent = agg._sum.amount ?? 0;
    } else {
      const agg = await db.expense.aggregate({
        where: {
          status: { in: [...SPENT_STATUSES] },
          date: { gte: window.start, lt: window.end },
          ...(b.scopeType === "category"
            ? { categoryId: b.scopeId }
            : { projectId: b.scopeId }),
        },
        _sum: { amount: true },
      });
      spent = agg._sum.amount ?? 0;
    }
    const pct = utilizationPct(spent, b.amount);
    views.push({
      id: b.id,
      scopeType: b.scopeType,
      label: names[b.scopeType].get(b.scopeId) ?? "(deleted)",
      period: b.period,
      amountFormatted: formatMoney(b.amount, org.currency),
      spentFormatted: formatMoney(spent, org.currency),
      pct,
      level: alertLevel(pct),
    });
  }

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Budgets</h1>
        <p className="text-muted-foreground text-sm">
          Utilization for the current period. Spend counts submitted, approved,
          and reimbursed expenses.
        </p>
      </div>
      {views.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No budgets yet</CardTitle>
            <CardDescription>
              Set a monthly, quarterly, or yearly amount per department,
              project, or category.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      <BudgetsPanel
        budgets={views}
        departments={departments}
        projects={projects}
        categories={categories}
      />
    </section>
  );
}

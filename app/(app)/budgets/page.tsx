import { computeBudgetUtilization } from "@/lib/analytics/budgets";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { BudgetsPanel, type BudgetView } from "./budgets-panel";



export default async function BudgetsPage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const [org, utilizations, departments, projects, categories] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    computeBudgetUtilization(db, new Date()),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const names = {
    department: new Map<string, string>(departments.map((d: { id: string; name: string }) => [d.id, d.name])),
    project: new Map<string, string>(projects.map((p: { id: string; name: string }) => [p.id, p.name])),
    category: new Map<string, string>(categories.map((c: { id: string; name: string }) => [c.id, c.name])),
  };

  const views: BudgetView[] = utilizations.map((b) => ({
    id: b.id,
    scopeType: b.scopeType,
    label: names[b.scopeType].get(b.scopeId) ?? "(deleted)",
    period: b.period,
    currency: org.currency,
    amount: b.amount,
    spent: b.spent,
    pct: b.pct,
    level: b.level,
  }));

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Budgets</h1>
        <p className="text-text-tertiary text-sm">
          Utilization for the current period. Spend counts submitted, approved,
          and reimbursed expenses.
        </p>
      </div>
      {views.length === 0 ? (
        <EmptyState
          headline="No budgets yet"
          description="Set an amount per department, project or category and this screen tracks spend against it. Add your first below."
        />
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

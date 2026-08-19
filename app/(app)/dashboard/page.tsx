import type { ReactNode } from "react";
import Link from "next/link";

import { BreakdownBarChart } from "@/components/charts/breakdown-bar";
import { MonthlyBarChart } from "@/components/charts/monthly-bar";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireSession } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import {
  avgApprovalMs,
  countViolations,
  formatDurationMs,
  lastMonthKeys,
  monthlyTotals,
  sumAmounts,
  topMerchants,
  totalsBy,
  type ExpenseAggRow,
} from "@/lib/domain/dashboard";
import { outstandingAdvance } from "@/lib/domain/advance";
import { complaintSummary } from "@/lib/complaints/queries";
import { buildExpenseWhere } from "@/lib/domain/expense-query";
import { resolveExpenseScope } from "@/lib/domain/expense-scope";
import { scopedDb } from "@/lib/db/scoped";
import { parseFilters } from "@/lib/schemas/dashboard";

type DbExpenseRow = {
  amount: number;
  baseAmount: number;
  currency: string;
  date: Date;
  status: string;
  merchant: string;
  categoryId: string;
  projectId: string | null;
  userId: string;
  flags: unknown;
  billable: boolean;
  clientId: string | null;
  client: { name: string } | null;
  user: { name: string; departmentId: string | null };
  category: { name: string };
  project: { name: string } | null;
};

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const filters = parseFilters(await searchParams);
  const isApprover = roleAtLeast(ctx.role, "approver");
  const isFinance = roleAtLeast(ctx.role, "finance_admin");

  const scope = await resolveExpenseScope(db, ctx);
  const where = buildExpenseWhere(scope, filters);

  const [org, user, dbRows, categories, departments, projects] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { name: true } }),
    db.expense.findMany({
      where,
      select: {
        amount: true,
        baseAmount: true,
        currency: true,
        date: true,
        status: true,
        merchant: true,
        categoryId: true,
        projectId: true,
        userId: true,
        flags: true,
        billable: true,
        clientId: true,
        client: { select: { name: true } },
        user: { select: { name: true, departmentId: true } },
        category: { select: { name: true } },
        project: { select: { name: true } },
      },
    }) as Promise<DbExpenseRow[]>,
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const deptNames = new Map<string, string>(
    departments.map((d: { id: string; name: string }) => [d.id, d.name])
  );
  const rows: ExpenseAggRow[] = dbRows.map((e) => ({
    amount: e.baseAmount, // dashboards aggregate in org-base currency (6.4)
    date: e.date,
    status: e.status,
    merchant: e.merchant,
    categoryId: e.categoryId,
    projectId: e.projectId,
    userId: e.userId,
    departmentId: e.user.departmentId,
    flagCount: Array.isArray(e.flags) ? e.flags.length : 0,
  }));
  const labelOf = {
    category: new Map(dbRows.map((e) => [e.categoryId, e.category.name])),
    project: new Map(dbRows.map((e) => [e.projectId ?? "—", e.project?.name ?? "No project"])),
    user: new Map(dbRows.map((e) => [e.userId, e.user.name])),
  };

  const now = new Date();
  const thisMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const months = lastMonthKeys(now, 6);
  const monthly = monthlyTotals(rows, months);
  const thisMonth = monthly.find((m) => m.month === thisMonthKey)?.total ?? 0;
  const pending = sumAmounts(rows.filter((r) => r.status === "submitted"));
  const reimbursed = sumAmounts(rows.filter((r) => r.status === "reimbursed"));
  const byCategory = totalsBy(
    rows,
    (r) => r.categoryId,
    (k) => labelOf.category.get(k) ?? "Unknown"
  );

  // finance-only aggregates
  const byDepartment = isFinance
    ? totalsBy(
        rows,
        (r) => r.departmentId,
        (k) => (k === null ? "No department" : (deptNames.get(k) ?? "Unknown"))
      )
    : [];
  const byProject = isFinance
    ? totalsBy(rows, (r) => r.projectId, (k) => labelOf.project.get(k ?? "—") ?? "No project")
    : [];
  const byUser = isApprover
    ? totalsBy(rows, (r) => r.userId, (k) => labelOf.user.get(k) ?? "Unknown")
    : [];
  const merchants = isFinance ? topMerchants(rows, 8) : [];
  const billableByClient = isFinance
    ? (() => {
        const map = new Map<string, { label: string; total: number; count: number }>();
        for (const e of dbRows) {
          if (!e.billable) continue;
          const key = e.clientId ?? "—";
          const entry = map.get(key) ?? {
            label: e.client?.name ?? "No client set",
            total: 0,
            count: 0,
          };
          entry.total += e.baseAmount;
          entry.count += 1;
          map.set(key, entry);
        }
        return [...map.entries()]
          .map(([key, v]) => ({ key, ...v }))
          .sort((a, b) => b.total - a.total);
      })()
    : [];
  const violations = isFinance ? countViolations(rows) : 0;

  let approvalTime: string | null = null;
  if (isFinance) {
    const decided = (await db.expenseReport.findMany({
      where: { status: { in: ["approved", "reimbursed"] }, submittedAt: { not: null } },
      select: {
        submittedAt: true,
        approvals: {
          where: { action: "approved" },
          orderBy: { actedAt: "desc" },
          take: 1,
          select: { actedAt: true },
        },
      },
      take: 500,
    })) as Array<{ submittedAt: Date | null; approvals: { actedAt: Date }[] }>;
    const ms = avgApprovalMs(
      decided
        .filter((r) => r.submittedAt && r.approvals.length > 0)
        .map((r) => ({ submittedAt: r.submittedAt!, decidedAt: r.approvals[0].actedAt }))
    );
    approvalTime = ms === null ? null : formatDurationMs(ms);
  }

  const myOpenAdvances = (await db.advance.findMany({
    where: { userId: ctx.userId, status: { in: ["disbursed", "partially_settled"] } },
    select: { amount: true, settledAmount: true },
  })) as Array<{ amount: number; settledAmount: number }>;
  // Complaints widget (7.3): finance sees the org-wide queue, everyone else
  // sees their own open disputes. Same query module as /complaints.
  const complaints = await complaintSummary(
    db,
    isFinance ? {} : { raisedById: ctx.userId }
  );

  const advanceBalance = myOpenAdvances.reduce(
    (sum, a) => sum + outstandingAdvance(a.amount, a.settledAmount),
    0
  );

  const exportQs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
  ).toString();

  const scopeLabel =
    scope.kind === "org" ? "organization" : scope.kind === "team" ? "your team" : "you";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome, {user.name}</h1>
          <p className="text-muted-foreground text-sm">
            Numbers below cover {scopeLabel}
            {filters.from || filters.to || filters.categoryId || filters.status
              ? " (filtered)"
              : ""}
            .
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={`/api/exports/expenses${exportQs ? `?${exportQs}` : ""}`}>
            Export CSV
          </a>
        </Button>
      </div>

      {isApprover ? (
        <form className="flex flex-wrap items-end gap-2" action="/dashboard" method="GET">
          <div className="grid gap-1">
            <label htmlFor="from" className="text-muted-foreground text-xs">From</label>
            <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} className="w-40" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="to" className="text-muted-foreground text-xs">To</label>
            <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} className="w-40" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="categoryId" className="text-muted-foreground text-xs">Category</label>
            <NativeSelect id="categoryId" name="categoryId" defaultValue={filters.categoryId ?? ""} className="w-40">
              <option value="">All categories</option>
              {categories.map((c: { id: string; name: string }) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </div>
          {isFinance ? (
            <>
              <div className="grid gap-1">
                <label htmlFor="departmentId" className="text-muted-foreground text-xs">Department</label>
                <NativeSelect id="departmentId" name="departmentId" defaultValue={filters.departmentId ?? ""} className="w-40">
                  <option value="">All departments</option>
                  {departments.map((d: { id: string; name: string }) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1">
                <label htmlFor="projectId" className="text-muted-foreground text-xs">Project</label>
                <NativeSelect id="projectId" name="projectId" defaultValue={filters.projectId ?? ""} className="w-40">
                  <option value="">All projects</option>
                  {projects.map((p: { id: string; name: string }) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </NativeSelect>
              </div>
            </>
          ) : null}
          <div className="grid gap-1">
            <label htmlFor="status" className="text-muted-foreground text-xs">Status</label>
            <NativeSelect id="status" name="status" defaultValue={filters.status ?? ""} className="w-36">
              <option value="">All statuses</option>
              <option value="draft">draft</option>
              <option value="submitted">submitted</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="reimbursed">reimbursed</option>
            </NativeSelect>
          </div>
          <Button type="submit" variant="outline">Apply</Button>
        </form>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Spend this month"
          value={<Amount value={thisMonth} currency={org.currency} size="display" />}
        />
        <Stat
          label="Awaiting approval"
          value={<Amount value={pending} currency={org.currency} size="display" />}
          hint="submitted expenses"
        />
        <Stat
          label="Reimbursed"
          value={<Amount value={reimbursed} currency={org.currency} size="display" />}
          hint="in current scope/filters"
        />
      </div>

      {complaints.open > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isFinance ? "Open complaints" : "My open complaints"}
            </CardTitle>
            <CardDescription>
              {isFinance
                ? "Disputes waiting on finance — 5 business-day target."
                : "Disputes you've raised that are still being looked at."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Stat label="Open" value={String(complaints.open)} />
            <Stat label="In review" value={String(complaints.inReview)} />
            <Stat
              label="Past SLA"
              value={String(complaints.breached)}
              hint={complaints.breached > 0 ? "needs attention today" : undefined}
            />
            <Stat
              label="Oldest"
              value={`${complaints.oldestOpenDays}d`}
              hint="business days"
            />
            <div className="sm:col-span-4">
              <Link href="/complaints" className="text-sm underline">
                {isFinance ? "Open the complaints inbox" : "View my complaints"}
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {advanceBalance > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Open advance balance"
            value={<Amount value={advanceBalance} currency={org.currency} size="display" />}
            hint="settles against your reimbursed reports"
          />
        </div>
      ) : null}

      {isFinance ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Total in scope"
            value={<Amount value={sumAmounts(rows)} currency={org.currency} size="display" />}
            hint={`${rows.length} expenses`}
          />
          <Stat label="Policy violations" value={String(violations)} hint="expenses with flags" />
          <Stat label="Avg approval time" value={approvalTime ?? "—"} hint="submission → final approval" />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly spend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No expenses yet — <Link href="/expenses/new" className="underline">capture one</Link>.
              </p>
            ) : (
              <MonthlyBarChart data={monthly} currency={org.currency} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing to show.</p>
            ) : (
              <BreakdownBarChart data={byCategory} currency={org.currency} />
            )}
          </CardContent>
        </Card>
      </div>

      {isApprover && byUser.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{isFinance ? "By user" : "Team members"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {byUser.slice(0, 10).map((u) => (
                <li key={u.key} className="flex justify-between gap-2">
                  <span>{u.label} <span className="text-muted-foreground">({u.count})</span></span>
                  <Amount value={u.total} currency={org.currency} align="right" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isFinance ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>By department</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid gap-1 text-sm">
                {byDepartment.slice(0, 8).map((d) => (
                  <li key={d.key} className="flex justify-between gap-2">
                    <span>{d.label}</span>
                    <Amount value={d.total} currency={org.currency} align="right" />
                  </li>
                ))}
                {byDepartment.length === 0 ? (
                  <li className="text-muted-foreground">Nothing to show.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>By project</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid gap-1 text-sm">
                {byProject.slice(0, 8).map((p) => (
                  <li key={p.key} className="flex justify-between gap-2">
                    <span>{p.label}</span>
                    <Amount value={p.total} currency={org.currency} align="right" />
                  </li>
                ))}
                {byProject.length === 0 ? (
                  <li className="text-muted-foreground">Nothing to show.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Billable by client</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid gap-1 text-sm">
                {billableByClient.slice(0, 8).map((c) => (
                  <li key={c.key} className="flex justify-between gap-2">
                    <span>{c.label} <span className="text-muted-foreground">({c.count})</span></span>
                    <Amount value={c.total} currency={org.currency} align="right" />
                  </li>
                ))}
                {billableByClient.length === 0 ? (
                  <li className="text-muted-foreground">No billable spend in scope.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top merchants</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid gap-1 text-sm">
                {merchants.map((m) => (
                  <li key={m.merchant} className="flex justify-between gap-2">
                    <span>{m.merchant} <span className="text-muted-foreground">({m.count})</span></span>
                    <Amount value={m.total} currency={org.currency} align="right" />
                  </li>
                ))}
                {merchants.length === 0 ? (
                  <li className="text-muted-foreground">Nothing to show.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

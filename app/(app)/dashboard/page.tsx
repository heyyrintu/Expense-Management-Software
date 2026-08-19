// Dashboards (D3.3) — DESIGN-PRD §7.4.
//
// One route, three screens. Which one you get is decided by the scope the
// server resolves from your role, never by a query parameter:
//
//   employee   my spend · awaiting approval · pending reimbursement · drafts
//   approver   the queue waiting on you, then the team's spend
//   finance    the four cards §7.4 names, org-wide
//
// ── THE ONE RULE THIS SCREEN EXISTS TO KEEP ───────────────────────────────
// "Every KPI clicks through to its filtered table — the number and the list
// must always agree." (§7.4)
//
// It holds here because there is ONE where-clause. The KPI strip, the trend
// chart, the category breakdown and the top-spender list are all built from
// the same `where` — the resolved scope, ANDed with the URL's filters — and
// every card's href is that same filter state serialised back out. A card and
// the list it opens are the same query narrowed differently, so they cannot
// drift.
//
// The single exception is finance's "Outstanding to employees", which is
// report totals minus payments and therefore not an expense sum at all. It is
// typed as `{ kind: "different" }` in lib/domain/dashboard-kpi.ts, which
// forces a written reason, and that reason renders under the strip. See the
// note there.
// ──────────────────────────────────────────────────────────────────────────
import Link from "next/link";

import { BreakdownBarChart } from "@/components/charts/breakdown-bar";
import { MonthlyBarChart } from "@/components/charts/monthly-bar";
import type { FacetConfig } from "@/components/filters";
import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiStrip } from "@/components/ui/kpi-strip";
import { PageHeader } from "@/components/ui/page-header";
import { RankList, type RankRow } from "@/components/ui/rank-list";
import { resolveActing } from "@/lib/auth/acting";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { cn } from "@/lib/utils";
import { approvalQueueFor } from "@/lib/domain/approval-queue";
import {
  buildApproverKpis,
  buildEmployeeKpis,
  buildFinanceKpis,
  expenseListHref,
  type DashboardKpi,
} from "@/lib/domain/dashboard-kpi";
import { lastMonthKeys, monthlyTotals } from "@/lib/domain/dashboard";
import { applyExpenseFilters, EXPENSE_LIST_ORDER } from "@/lib/domain/expense-query";
import {
  narrowViewScope,
  resolveExpenseScope,
  viewScopeWhere,
  type ExpenseViewScope,
} from "@/lib/domain/expense-scope";
import type { StatusGroup } from "@/lib/domain/expense-stats";
import { payableQuery, summarisePayable } from "@/lib/domain/payable";
import { parseExpenseFilters } from "@/lib/schemas/expense-filters";
import { DashboardFilters } from "./dashboard-filters";
import {
  DASH_CHART_GRID,
  DASH_CHART_MAIN,
  DASH_CHART_SIDE,
  DASH_PANEL_GRID,
  DASH_PANEL_HALF,
  DASH_STACK,
} from "./layout-grid";

/** How many months of history the trend chart and the deltas read. */
const TREND_MONTHS = 6;
/** Rows in the "recent expenses" panel. Enough to recognise this week. */
const RECENT_LIMIT = 6;

type TrendRow = { date: Date; baseAmount: number };
type BreakdownRow = {
  categoryId: string;
  _sum: { baseAmount: number | null };
  _count: { _all: number };
};
type SpenderRow = {
  userId: string;
  _sum: { baseAmount: number | null };
  _count: { _all: number };
};
type RecentRow = {
  id: string;
  merchant: string;
  baseAmount: number;
  currency: string;
  amount: number;
  date: Date;
  status: string;
  user: { name: string };
  category: { name: string };
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const acting = await resolveActing(ctx);
  const db = scopedDb(ctx.orgId);
  const filters = parseExpenseFilters(await searchParams);

  // Scope comes from the ROLE, server-side. Unlike /expenses there is no
  // `?scope=` here: a dashboard is the widest view its reader is entitled to,
  // and offering a narrower one would just be the filter bar with worse
  // wording.
  const ceiling = await resolveExpenseScope(db, ctx);
  const view: ExpenseViewScope = narrowViewScope(
    ceiling,
    ceiling.kind === "org" ? "org" : ceiling.kind === "team" ? "team" : "mine"
  );
  const scopeWhere = viewScopeWhere(ceiling, view, acting.effectiveUserId);

  // THE where-clause. Everything below is this, narrowed.
  const where = applyExpenseFilters(scopeWhere, filters);

  const now = new Date();
  const months = lastMonthKeys(now, TREND_MONTHS);
  const trendFrom = new Date(`${months[0]}-01T00:00:00.000Z`);

  // The trend keeps every filter EXCEPT the date range, and always shows the
  // same six months. A six-month chart of a one-week filter is one bar with
  // five empty slots beside it, and a "trend" whose window moves with the
  // filter isn't a trend — it's the KPI again, drawn wider. Dropping the
  // range here rather than spreading a `date` over `where` matters: the
  // filters live inside an AND, so an outer date would have intersected with
  // the reader's range instead of replacing it.
  const trendWhere = {
    ...applyExpenseFilters(scopeWhere, { ...filters, from: undefined, to: undefined }),
    date: { gte: trendFrom },
  };

  const [org, user, statusGroups, byCategoryRows, categories, projects, departments, trendRows, recent] =
    await Promise.all([
      db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
      db.user.findUniqueOrThrow({
        where: { id: acting.effectiveUserId },
        select: { name: true },
      }),
      // The KPI strip. Same `where` as everything else on the screen, so
      // "total spend" is the sum of the rows the charts describe.
      db.expense.groupBy({
        by: ["status"],
        where,
        _sum: { baseAmount: true },
        _count: { _all: true },
      }) as Promise<StatusGroup[]>,
      db.expense.groupBy({
        by: ["categoryId"],
        where,
        _sum: { baseAmount: true },
        _count: { _all: true },
      }) as Promise<BreakdownRow[]>,
      db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) as Promise<
        Array<{ id: string; name: string }>
      >,
      db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) as Promise<
        Array<{ id: string; name: string }>
      >,
      db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) as Promise<
        Array<{ id: string; name: string }>
      >,
      // The trend deliberately IGNORES the date filter and always reads the
      // last six months: a six-month chart of a one-week filter is one bar,
      // and a "trend" that changes shape with the range isn't a trend. Every
      // other dimension of the filter still applies, and the chart says so.
      db.expense.findMany({
        where: trendWhere,
        select: { date: true, baseAmount: true },
      }) as Promise<TrendRow[]>,
      db.expense.findMany({
        where,
        orderBy: EXPENSE_LIST_ORDER,
        take: RECENT_LIMIT,
        select: {
          id: true,
          merchant: true,
          amount: true,
          baseAmount: true,
          currency: true,
          date: true,
          status: true,
          user: { select: { name: true } },
          category: { select: { name: true } },
        },
      }) as Promise<RecentRow[]>,
    ]);

  const monthly = monthlyTotals(
    trendRows.map((r) => ({ amount: r.baseAmount, date: r.date })),
    months
  );

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory: RankRow[] = byCategoryRows
    .map((r) => ({
      key: r.categoryId,
      label: categoryName.get(r.categoryId) ?? "Uncategorised",
      total: r._sum.baseAmount ?? 0,
      count: r._count._all,
      // Every row opens the expenses behind it — the screen's filters plus
      // this one category. Same contract as the cards above.
      href: expenseListHref(
        { ...filters, categoryId: [r.categoryId] },
        { scope: view }
      ),
    }))
    .sort((a, b) => b.total - a.total);

  // ── The three dashboards ────────────────────────────────────────────────
  const isApprover = ceiling.kind !== "employee";
  const isFinance = ceiling.kind === "org";

  let kpis: DashboardKpi[];
  let spenders: RankRow[] = [];

  if (isFinance) {
    const [payable, spenderRows] = await Promise.all([
      db.expenseReport.findMany({
        ...payableQuery(),
        select: { total: true, reimbursements: { select: { amountPaid: true } } },
      }) as Promise<Array<{ total: number; reimbursements: Array<{ amountPaid: number }> }>>,
      db.expense.groupBy({
        by: ["userId"],
        where,
        _sum: { baseAmount: true },
        _count: { _all: true },
      }) as Promise<SpenderRow[]>,
    ]);

    kpis = buildFinanceKpis({
      groups: statusGroups,
      filters,
      currency: org.currency,
      monthly,
      payable: summarisePayable(payable),
    });

    const people = await db.user.findMany({
      where: { id: { in: spenderRows.map((r) => r.userId) } },
      select: { id: true, name: true },
    }) as Array<{ id: string; name: string }>;
    const personName = new Map(people.map((p) => [p.id, p.name]));
    spenders = spenderRows
      .map((r) => ({
        key: r.userId,
        label: personName.get(r.userId) ?? "Unknown",
        total: r._sum.baseAmount ?? 0,
        count: r._count._all,
        href: expenseListHref({ ...filters, userId: [r.userId] }, { scope: view }),
      }))
      .sort((a, b) => b.total - a.total);
  } else if (isApprover) {
    const queue = await approvalQueueFor(db, ctx);
    kpis = buildApproverKpis({
      groups: statusGroups,
      filters,
      currency: org.currency,
      monthly,
      queue: {
        count: queue.length,
        total: queue.reduce((sum, q) => sum + q.total, 0),
        flagged: queue.filter((q) => q.flagged).length,
      },
    });

    const spenderRows = (await db.expense.groupBy({
      by: ["userId"],
      where,
      _sum: { baseAmount: true },
      _count: { _all: true },
    })) as SpenderRow[];
    const people = (await db.user.findMany({
      where: { id: { in: spenderRows.map((r) => r.userId) } },
      select: { id: true, name: true },
    })) as Array<{ id: string; name: string }>;
    const personName = new Map(people.map((p) => [p.id, p.name]));
    spenders = spenderRows
      .map((r) => ({
        key: r.userId,
        label: personName.get(r.userId) ?? "Unknown",
        total: r._sum.baseAmount ?? 0,
        count: r._count._all,
        href: expenseListHref({ ...filters, userId: [r.userId] }, { scope: view }),
      }))
      .sort((a, b) => b.total - a.total);
  } else {
    kpis = buildEmployeeKpis({
      groups: statusGroups,
      filters,
      currency: org.currency,
      monthly,
    });
  }

  // Facets are role-shaped: an employee filtering by department would be
  // filtering a set of one. Not sent rather than sent-and-hidden.
  const facets: FacetConfig[] = [
    {
      key: "categoryId",
      label: "Category",
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    ...(isFinance
      ? ([
          {
            key: "departmentId" as const,
            label: "Department",
            options: departments.map((d) => ({ value: d.id, label: d.name })),
          },
          {
            key: "projectId" as const,
            label: "Project",
            options: projects.map((p) => ({ value: p.id, label: p.name })),
          },
        ] satisfies FacetConfig[])
      : []),
  ];

  const title = isFinance
    ? "Finance overview"
    : isApprover
      ? "Team overview"
      : `Welcome, ${user.name}`;
  const description = isFinance
    ? "Every expense in the organisation. Each figure opens the list it was counted from."
    : isApprover
      ? "You and everyone who reports to you."
      : "Your spend, and what is still moving through approval.";

  const hasAnything = statusGroups.length > 0;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <Button asChild>
            <Link href="/expenses/new">Add expense</Link>
          </Button>
        }
      />

      <div className={DASH_STACK}>
        <DashboardFilters facets={facets} />

        <KpiStrip kpis={kpis} />

        <div className={DASH_CHART_GRID}>
          <div className={DASH_CHART_MAIN}>
            <MonthlyBarChart data={monthly} currency={org.currency} />
          </div>
          <div className={DASH_CHART_SIDE}>
            <BreakdownBarChart
              data={byCategory.map((c) => ({ label: c.label, total: c.total }))}
              currency={org.currency}
            />
          </div>
        </div>

        <div className={DASH_PANEL_GRID}>
          <Panel
            className={DASH_PANEL_HALF}
            title={isApprover ? "Top spenders" : "Where it went"}
            description={
              isApprover
                ? "Highest first. Each row opens that person's expenses in this view."
                : "By category. Each row opens the expenses behind it."
            }
          >
            <RankList
              rows={isApprover ? spenders : byCategory}
              currency={org.currency}
              emptyMessage="No expenses match this view yet."
            />
          </Panel>

          <Panel
            className={DASH_PANEL_HALF}
            title="Recent expenses"
            description="Newest first, across everything in view."
          >
            {recent.length === 0 ? (
              <EmptyState
                headline={hasAnything ? "Nothing in this view" : "No expenses yet"}
                description={
                  hasAnything
                    ? "Widen the filters above to see more."
                    : "Capture the first one — it takes about fifteen seconds."
                }
                action={
                  hasAnything ? undefined : (
                    <Button asChild>
                      <Link href="/expenses/new">Add expense</Link>
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="divide-line grid divide-y">
                {recent.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/expenses/${e.id}`}
                      className="hover:bg-bg-subtle -mx-2 grid gap-1 rounded-md px-2 py-3 transition-colors duration-instant ease-out outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-body text-text-primary truncate">
                          {e.merchant}
                        </span>
                        {/* Raw minor units to a client child; never a
                            pre-formatted string (D1.1). */}
                        <Amount value={e.amount} currency={e.currency} align="right" />
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <DateCell value={e.date.toISOString()} />
                        <span className="text-meta text-text-tertiary">
                          {e.category.name}
                          {isApprover ? ` · ${e.user.name}` : ""}
                        </span>
                        <StatusBadge status={e.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** A dashboard panel. Border, no shadow — §4.2: one or the other, never both. */
function Panel({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "border-line bg-bg-surface grid content-start gap-4 rounded-lg border p-5",
        className
      )}
    >
      <div className="grid gap-1">
        <h2 className="text-h3 text-text-primary">{title}</h2>
        {description ? (
          <p className="text-meta text-text-tertiary">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

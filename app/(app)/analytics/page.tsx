import Link from "next/link";

import { TrendAreaChart } from "@/components/charts/trend-area";
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchSpendRows } from "@/lib/analytics";
import {
  approverBottlenecks,
  monthlySeriesByDimension,
  violationLeaderboard,
  type Dimension,
} from "@/lib/analytics/aggregate";
import { computeBudgetUtilization } from "@/lib/analytics/budgets";
import { requireRole } from "@/lib/auth/guard";
import { formatDurationMs } from "@/lib/domain/dashboard";
import { scopedDb } from "@/lib/db/scoped";
import { cn } from "@/lib/utils";

const RULE_LABELS: Record<string, string> = {
  per_expense_limit: "Over per-expense limit",
  monthly_limit: "Over monthly limit",
  receipt_required: "Missing receipt",
  expense_age: "Too old",
  duplicate: "Possible duplicate",
  auto_created: "Auto-created",
  email_ingested: "From email",
};

const BAR_COLORS = { ok: "bg-green-500", warn: "bg-amber-500", over: "bg-red-500" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const raw = await searchParams;
  const dim: Dimension = ["category", "department", "project"].includes(String(raw.dim))
    ? (String(raw.dim) as Dimension)
    : "category";

  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [org, rows, budgets, decidedReports, oldestPending, names] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    fetchSpendRows(db, { start: windowStart, end: windowEnd }),
    computeBudgetUtilization(db, now),
    db.expenseReport.findMany({
      where: {
        status: { in: ["approved", "partially_reimbursed", "reimbursed"] },
        submittedAt: { gte: windowStart, not: null },
      },
      select: {
        submittedAt: true,
        approvals: {
          where: { action: "approved" },
          orderBy: { actedAt: "desc" },
          take: 1,
          select: { actedAt: true, approverId: true, approver: { select: { name: true } } },
        },
      },
      take: 1000,
    }) as Promise<
      Array<{
        submittedAt: Date | null;
        approvals: Array<{ actedAt: Date; approverId: string; approver: { name: string } }>;
      }>
    >,
    db.expenseReport.findMany({
      where: { status: "submitted" },
      orderBy: { submittedAt: "asc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }) as Promise<
      Array<{ id: string; title: string; submittedAt: Date | null; user: { name: string } }>
    >,
    Promise.all([
      db.department.findMany({ select: { id: true, name: true } }),
      db.project.findMany({ select: { id: true, name: true } }),
      db.category.findMany({ select: { id: true, name: true } }),
    ]),
  ]);

  const trend = monthlySeriesByDimension(rows, dim, now, 12);
  const leaderboard = violationLeaderboard(rows);
  const bottlenecks = approverBottlenecks(
    decidedReports
      .filter((r) => r.submittedAt && r.approvals.length > 0)
      .map((r) => ({
        approverId: r.approvals[0].approverId,
        approverName: r.approvals[0].approver.name,
        submittedAt: r.submittedAt!,
        decidedAt: r.approvals[0].actedAt,
      }))
  );
  const [departments, projects, categories] = names;
  const scopeName: Record<"department" | "project" | "category", Map<string, string>> = {
    department: new Map<string, string>(
      departments.map((d: { id: string; name: string }) => [d.id, d.name])
    ),
    project: new Map<string, string>(
      projects.map((p: { id: string; name: string }) => [p.id, p.name])
    ),
    category: new Map<string, string>(
      categories.map((c: { id: string; name: string }) => [c.id, c.name])
    ),
  };
  const lastRun =
    typeof (org.settings as Record<string, unknown>)?.monthlySummaryLastRun === "string"
      ? String((org.settings as Record<string, unknown>).monthlySummaryLastRun)
      : null;

  const DAY = 24 * 3600_000;

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Spend = submitted, approved, and reimbursed expenses in {org.currency},
          last 12 months.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Spend trend</CardTitle>
            <div className="flex gap-1">
              {(["category", "department", "project"] as const).map((d) => (
                <Button key={d} asChild size="sm" variant={d === dim ? "default" : "outline"}>
                  <Link href={`/analytics?dim=${d}`}>{d}</Link>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No spend in the window.</p>
          ) : (
            <TrendAreaChart series={trend.series} labels={trend.labels} currency={org.currency} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Policy violations — by type</CardTitle>
            <CardDescription>Click a row to see the expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {leaderboard.byType.map((t) => (
                <li key={t.rule} className="flex justify-between gap-2">
                  <Link href={`/analytics/violations?rule=${t.rule}`} className="hover:underline">
                    {RULE_LABELS[t.rule] ?? t.rule}
                  </Link>
                  <span className="font-medium">{t.count}</span>
                </li>
              ))}
              {leaderboard.byType.length === 0 ? (
                <li className="text-muted-foreground">No violations — spotless.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Policy violations — by user</CardTitle>
            <CardDescription>Flagged expenses per person.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {leaderboard.byUser.slice(0, 8).map((u) => (
                <li key={u.userId} className="flex justify-between gap-2">
                  <Link href={`/analytics/violations?user=${u.userId}`} className="hover:underline">
                    {u.userName}
                  </Link>
                  <span>
                    <span className="font-medium">{u.count}</span>{" "}
                    <span className="text-muted-foreground">
                      (<Amount value={u.total} currency={org.currency} size="meta" tone="muted" />)
                    </span>
                  </span>
                </li>
              ))}
              {leaderboard.byUser.length === 0 ? (
                <li className="text-muted-foreground">No violations — spotless.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approval bottlenecks</CardTitle>
            <CardDescription>Submission → final approval, last 12 months.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="pb-1 font-medium">Approver</th>
                  <th className="pb-1 font-medium">Decided</th>
                  <th className="pb-1 font-medium">Avg</th>
                  <th className="pb-1 font-medium">p90</th>
                </tr>
              </thead>
              <tbody>
                {bottlenecks.map((b) => (
                  <tr key={b.approverId} className="border-t">
                    <td className="py-1">{b.approverName}</td>
                    <td className="py-1">{b.count}</td>
                    <td className="py-1">{formatDurationMs(b.avgMs)}</td>
                    <td className="py-1">{formatDurationMs(b.p90Ms)}</td>
                  </tr>
                ))}
                {bottlenecks.length === 0 ? (
                  <tr><td className="text-muted-foreground py-1" colSpan={4}>No decided reports yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Oldest pending reports</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {oldestPending.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2">
                  <Link href={`/approvals/${r.id}`} className="hover:underline">
                    {r.title} <span className="text-muted-foreground">({r.user.name})</span>
                  </Link>
                  <span className="text-muted-foreground">
                    {r.submittedAt
                      ? `${Math.floor((now.getTime() - r.submittedAt.getTime()) / DAY)}d waiting`
                      : ""}
                  </span>
                </li>
              ))}
              {oldestPending.length === 0 ? (
                <li className="text-muted-foreground">Nothing pending.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget vs actual</CardTitle>
          <CardDescription>
            Current period — <Link href="/budgets" className="underline">manage budgets</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3">
            {budgets.map((b) => (
              <li key={b.id} className="grid gap-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span>
                    {scopeName[b.scopeType].get(b.scopeId) ?? "(deleted)"}{" "}
                    <span className="text-muted-foreground">· {b.scopeType} · {b.period}</span>
                  </span>
                  <span className="whitespace-nowrap">
                    <Amount value={b.spent} currency={org.currency} tone="muted" /> /{" "}
                    <Amount value={b.amount} currency={org.currency} />
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={cn("h-full rounded-full", BAR_COLORS[b.level])}
                    style={{ width: `${Math.min(b.pct, 100)}%` }}
                  />
                </div>
              </li>
            ))}
            {budgets.length === 0 ? (
              <li className="text-muted-foreground text-sm">No budgets configured.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Monthly summary email:{" "}
        {lastRun ? (
          <>
            {"last sent "}
            <DateCell value={new Date(lastRun)} tone="muted" />
          </>
        ) : (
          "not yet sent"
        )}{" "}
        — runs via
        /api/cron/monthly-summary (see README).
      </p>
    </section>
  );
}

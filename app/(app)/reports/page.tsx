import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { StatusBadge } from "@/components/status-badge";
import { resolveActing } from "@/lib/auth/acting";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
// inside a template literal, which is what lib/format is for.

type ReportRow = {
  id: string;
  title: string;
  status: string;
  total: number;
  submittedAt: Date | null;
  createdAt: Date;
  _count: { expenses: number };
};

export default async function ReportsPage() {
  const ctx = await requireSession();
  const [org, reports] = await Promise.all([
    scopedDb(ctx.orgId).organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    scopedDb(ctx.orgId).expenseReport.findMany({
      where: { userId: (await resolveActing(ctx)).effectiveUserId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { expenses: true } } },
    }) as Promise<ReportRow[]>,
  ]);

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">My reports</h1>
          <p className="text-text-tertiary text-sm">
            Group draft expenses into a report and submit it for approval.
          </p>
        </div>
        {/* D5.5: the empty state below carries this same action as ITS
            primary, so showing both put two filled buttons on screen. */}
        {reports.length > 0 ? (
          <Button asChild>
            <Link href="/reports/new">New report</Link>
          </Button>
        ) : null}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          headline="No reports yet"
          description="A report groups your draft expenses into one submission. Create one, add expenses, and send it for approval."
          action={
            <Button asChild>
              <Link href="/reports/new">Create a report</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/reports/${r.id}`}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="truncate">{r.title}</CardTitle>
                      <div className="flex items-center gap-3">
                        <Amount value={r.total} currency={org.currency} />
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <CardDescription>
                      {r._count.expenses} expense{r._count.expenses === 1 ? "" : "s"}
                      {r.submittedAt
                        ? " · submitted "
                        : " · created "}
                      <DateCell
                        value={r.submittedAt ?? r.createdAt}
                        tone="muted"
                      />
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

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
      where: { userId: ctx.userId },
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
          <p className="text-muted-foreground text-sm">
            Group draft expenses into a report and submit it for approval.
          </p>
        </div>
        <Button asChild>
          <Link href="/reports/new">New report</Link>
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No reports yet</CardTitle>
            <CardDescription>
              Create a report, add your draft expenses, and submit for approval.
            </CardDescription>
            <Button asChild className="mt-2 w-fit self-center">
              <Link href="/reports/new">Create your first report</Link>
            </Button>
          </CardHeader>
        </Card>
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
                        <span className="font-semibold">
                          {formatMoney(r.total, org.currency)}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <CardDescription>
                      {r._count.expenses} expense{r._count.expenses === 1 ? "" : "s"}
                      {r.submittedAt
                        ? ` · submitted ${formatDate(r.submittedAt)}`
                        : ` · created ${formatDate(r.createdAt)}`}
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

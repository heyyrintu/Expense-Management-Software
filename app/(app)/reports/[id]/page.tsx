import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/guard";
import {
  computeReportTotal,
  isReportEditable,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ReportControls } from "./report-controls";

type ExpenseRow = {
  id: string;
  amount: number;
  currency: string;
  date: Date;
  merchant: string;
  category: { name: string };
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  // own reports only (approver views arrive in 2.2)
  const report = await db.expenseReport.findUnique({
    where: { id, userId: ctx.userId },
    include: {
      expenses: {
        orderBy: { date: "desc" },
        include: { category: { select: { name: true } } },
      },
    },
  });
  if (!report) notFound();

  const editable = isReportEditable(report.status as ReportStatus);
  const attached: ExpenseRow[] = report.expenses;
  const runningTotal = computeReportTotal(attached.map((e) => e.amount));
  const currency = attached[0]?.currency;

  // pickable: session user's unattached draft expenses
  const available: ExpenseRow[] = editable
    ? await db.expense.findMany({
        where: { userId: ctx.userId, status: "draft", reportId: null },
        orderBy: { date: "desc" },
        take: 100,
        include: { category: { select: { name: true } } },
      })
    : [];

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{report.title}</h1>
          <StatusBadge status={report.status} />
        </div>
        <ReportControls
          reportId={report.id}
          status={report.status as ReportStatus}
          expenseCount={attached.length}
        />
      </div>

      {report.submittedAt ? (
        <p className="text-muted-foreground -mt-4 text-sm">
          Submitted {formatDate(report.submittedAt)}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {attached.length === 0
              ? "No expenses on this report"
              : `Total ${currency ? formatMoney(runningTotal, currency) : ""}`}
          </CardTitle>
          <CardDescription>
            {attached.length} expense{attached.length === 1 ? "" : "s"} attached
          </CardDescription>
        </CardHeader>
        {attached.length > 0 ? (
          <CardContent>
            <ul className="grid gap-2">
              {attached.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <span className="grid">
                    <Link href={`/expenses/${e.id}`} className="font-medium hover:underline">
                      {e.merchant}
                    </Link>
                    <span className="text-muted-foreground">
                      {formatDate(e.date)} · {e.category.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold">
                      {formatMoney(e.amount, e.currency)}
                    </span>
                    {editable ? (
                      <ReportControls.RemoveButton
                        reportId={report.id}
                        expenseId={e.id}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle>Add expenses</CardTitle>
            <CardDescription>
              {available.length === 0
                ? "No unattached draft expenses — capture one first."
                : "Your draft expenses not yet on a report."}
            </CardDescription>
          </CardHeader>
          {available.length > 0 ? (
            <CardContent>
              <ul className="grid gap-2">
                {available.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <span className="grid">
                      <span className="font-medium">{e.merchant}</span>
                      <span className="text-muted-foreground">
                        {formatDate(e.date)} · {e.category.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold">
                        {formatMoney(e.amount, e.currency)}
                      </span>
                      <ReportControls.AddButton
                        reportId={report.id}
                        expenseId={e.id}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { StatusBadge } from "@/components/status-badge";
import { resolveActing } from "@/lib/auth/acting";
import { requireSession } from "@/lib/auth/guard";
import {
  computeReportTotal,
  isReportEditable,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb } from "@/lib/db/scoped";
import { CommentThread, type CommentView } from "@/components/comment-thread";
import { outstandingBalance } from "@/lib/domain/reimbursement";
import { signedProofUrl } from "@/lib/storage/payment-proofs";
import { RaiseComplaint } from "../../complaints/raise-complaint";
// inside template literals — lib/money is the sanctioned string formatter.
import { ReportControls } from "./report-controls";

type ExpenseRow = {
  id: string;
  amount: number;
  baseAmount: number;
  currency: string;
  fxRate: string;
  date: Date;
  merchant: string;
  flags: unknown;
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
  const acting = await resolveActing(ctx);
  const report = await db.expenseReport.findUnique({
    where: { id, userId: acting.effectiveUserId },
    include: {
      expenses: {
        orderBy: { date: "desc" },
        include: { category: { select: { name: true } } },
      },
      reimbursements: {
        orderBy: { paidAt: "asc" },
        select: {
          id: true,
          amountPaid: true,
          method: true,
          paidAt: true,
          reference: true,
          proofKey: true,
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!report) notFound();

  type PaymentView = {
    id: string;
    when: Date;
    /** Integer MINOR units — rendered through <Amount>, never pre-formatted. */
    amountPaid: number;
    method: string;
    reference: string;
    proofUrl: string | null;
    hasProof: boolean;
  };
  const paymentViews: PaymentView[] = await Promise.all(
    report.reimbursements.map(
      async (p: {
        id: string;
        amountPaid: number;
        method: string;
        paidAt: Date;
        reference: string;
        proofKey: string | null;
      }) => ({
        id: p.id,
        when: p.paidAt,
        amountPaid: p.amountPaid,
        method: p.method.replace("_", " "),
        reference: p.reference,
        proofUrl: p.proofKey ? await signedProofUrl({ proofKey: p.proofKey }) : null,
        hasProof: Boolean(p.proofKey),
      })
    )
  );

  const commentViews: CommentView[] = report.comments.map(
    (c: { id: string; body: string; createdAt: Date; authorId: string; author: { name: string } }) => ({
      id: c.id,
      authorName: c.author.name,
      body: c.body,
      when: c.createdAt,
      mine: c.authorId === ctx.userId,
    })
  );

  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  // Complaints (7.3) are raised by the person the report belongs to, once the
  // report has left Draft and there is a decision or a payment to dispute.
  const isOwner = report.userId === ctx.userId;
  const complaintableReport = report.status !== "draft";
  const editable = isReportEditable(report.status as ReportStatus);
  const attached: ExpenseRow[] = report.expenses;
  const runningTotal = computeReportTotal(attached.map((e) => e.baseAmount));
  const currency = org.currency; // totals are always org-base (6.4)

  // pickable: session user's unattached draft expenses
  const available: ExpenseRow[] = editable
    ? await db.expense.findMany({
        where: { userId: acting.effectiveUserId, status: "draft", reportId: null },
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
          Submitted <DateCell value={report.submittedAt} tone="muted" />
        </p>
      ) : null}

      {report.reimbursements.length > 0 ? (
        <div className="grid gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          <p className="font-medium">
            Payments
            {currency && report.status === "partially_reimbursed" ? (
              <>
                {" — outstanding "}
                <Amount
                  value={outstandingBalance(report.total, report.reimbursements)}
                  currency={currency}
                />
              </>
            ) : null}
          </p>
          <ul className="grid gap-1">
            {paymentViews.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <DateCell value={p.when} />
                <Amount value={p.amountPaid} currency={currency} />
                <span>{p.method}</span>
                <span className="text-violet-900/70">ref {p.reference}</span>
                {p.proofUrl ? (
                  <a
                    href={p.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    View proof
                  </a>
                ) : null}
                {isOwner ? (
                  <RaiseComplaint
                    reimbursementId={p.id}
                    types={["payment_not_received", "wrong_amount", "other"]}
                    label="Something wrong?"
                    hasPaymentProof={p.hasProof}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isOwner && complaintableReport ? (
        <div className="grid gap-2">
          <RaiseComplaint
            reportId={report.id}
            types={
              report.status === "rejected"
                ? ["unfair_rejection", "wrong_amount", "other"]
                : ["wrong_amount", "other"]
            }
          />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {attached.length === 0 ? (
              "No expenses on this report"
            ) : currency ? (
              <>
                {"Total "}
                <Amount value={runningTotal} currency={currency} />
              </>
            ) : (
              "Total"
            )}
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
                  <span className="grid gap-1">
                    <Link href={`/expenses/${e.id}`} className="font-medium hover:underline">
                      {e.merchant}
                    </Link>
                    <span className="text-muted-foreground">
                      <DateCell value={e.date} tone="muted" /> · {e.category.name}
                    </span>
                    <FlagChips flags={asFlags(e.flags)} />
                  </span>
                  <span className="flex items-center gap-3">
                    <Amount
                      value={e.amount}
                      currency={e.currency}
                      align="right"
                      converted={
                        e.currency !== currency
                          ? { value: e.baseAmount, currency }
                          : null
                      }
                    />
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
                        <DateCell value={e.date} tone="muted" /> · {e.category.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Amount value={e.amount} currency={e.currency} align="right" />
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

      <CommentThread reportId={report.id} comments={commentViews} />
    </section>
  );
}

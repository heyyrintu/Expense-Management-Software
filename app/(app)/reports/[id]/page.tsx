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
import { PageHeader } from "@/components/ui/page-header";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { PaymentProgress } from "@/components/ui/payment-progress";
import { PolicyFlagChips } from "@/components/ui/policy-flag-chip";
import { DateCell } from "@/components/ui/date-cell";
import { FlagChips } from "@/components/flag-chips";
// asFlags comes from the DOMAIN module, not the client component that
// re-exports it: importing it from "@/components/flag-chips" in a server
// component turns a pure function into a client reference, and calling it
// on the server throws "Attempted to call asFlags() from the server".
import { asFlags } from "@/lib/domain/policy-flags";
import { StatusBadge } from "@/components/status-badge";
import { resolveActing } from "@/lib/auth/acting";
import { requireSession } from "@/lib/auth/guard";
import { fetchPriorExports } from "@/lib/accounting/queries";
import { exportStatusFor } from "@/lib/domain/accounting-export";
import {
  computeReportTotal,
  isReportEditable,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb } from "@/lib/db/scoped";
import { CommentThread, type CommentView } from "@/components/comment-thread";
import { outstandingBalance } from "@/lib/domain/reimbursement";
import { buildReportTimeline, hasTimeline } from "@/lib/domain/report-timeline";
import { resolveChain } from "@/lib/domain/approval-chain";
import { secondApprovalThreshold } from "@/lib/domain/org-settings";
import type { SubmitPreview } from "./submit-dialog";
import { signedProofUrl } from "@/lib/storage/payment-proofs";
import { RaiseComplaint } from "../../complaints/raise-complaint";
// inside template literals — lib/money is the sanctioned string formatter.
import { AddButton, RemoveButton, ReportControls } from "./report-controls";

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
  // Accounting-export history for this report (FINAL-AUDIT §4). Read here
  // rather than in a child so the page has one round trip, and shown to the
  // OWNER as well as finance: "has this reached the books yet" is the
  // question behind most "where is my money" emails.
  const priorExports = await fetchPriorExports(db, [id]);
  const exportStatus = exportStatusFor(id, priorExports);
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
      // For the timeline: when it was approved, not just that it was.
      approvals: {
        orderBy: { actedAt: "asc" },
        select: { action: true, actedAt: true },
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

  // Every flag on the report, for the summary strip and the submit dialog.
  const reportFlags = attached.flatMap((e) => asFlags(e.flags));

  // The approver the SUBMIT ACTION will route to — same resolveChain, same
  // inputs. Naming a different person in the dialog than the one who gets the
  // notification would be worse than naming nobody.
  const me = await db.user.findUniqueOrThrow({
    where: { id: acting.effectiveUserId },
    select: { approverId: true, departmentId: true },
  });
  const chain = resolveChain({
    ownerAssignedApproverId: me.approverId,
    ownerDepartmentId: me.departmentId,
    total: runningTotal,
    orgThreshold: secondApprovalThreshold(org.settings),
    rules: await db.approvalRule.findMany({ orderBy: { createdAt: "asc" } }),
  });
  const approver = chain.level1ApproverId
    ? ((await db.user.findUnique({
        where: { id: chain.level1ApproverId, status: "active" },
        select: { name: true },
      })) as { name: string } | null)
    : null;

  const submitPreview: SubmitPreview = {
    expenseCount: attached.length,
    total: runningTotal,
    currency,
    approverName: approver?.name ?? null,
    needsSecondApproval: chain.level2 !== null,
    flags: reportFlags,
  };

  const approvedAt =
    report.approvals.find((a: { action: string }) => a.action === "approve")?.actedAt ?? null;
  const paidAt = report.reimbursements.at(-1)?.paidAt ?? null;
  const timeline = buildReportTimeline({
    status: report.status as ReportStatus,
    submittedAt: report.submittedAt,
    approvedAt,
    paidAt,
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: report.title }]}
        title={report.title}
        description={`${attached.length} expense${attached.length === 1 ? "" : "s"}`}
        action={
          <ReportControls
            reportId={report.id}
            status={report.status as ReportStatus}
            expenseCount={attached.length}
            preview={submitPreview}
          />
        }
      />

      {/* The total is the report's headline figure, so it gets the display
          size (§4.3: the number is the hero) rather than being one line of a
          card three screens down. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <span className="text-label text-text-secondary">Total</span>
          <Amount value={runningTotal} currency={currency} size="display" />
        </div>
        <StatusBadge status={report.status} />
      </div>

      <section className="grid gap-6">
      {hasTimeline(report.status as ReportStatus) ? (
        <StatusTimeline steps={timeline} />
      ) : null}

      {exportStatus.length > 0 ? (
        // Neutral, not success: reaching the accounting system is a fact about
        // bookkeeping, not an outcome for the person who filed the report.
        // Colouring it green would imply a payment that may not have happened.
        <div className="border-line bg-bg-subtle grid gap-1 rounded-lg border p-3">
          <p className="text-label text-text-secondary">Sent to accounting</p>
          <ul className="grid gap-1">
            {exportStatus.map((e) => (
              <li key={e.target} className="text-meta text-text-tertiary">
                {e.target} — <DateCell value={e.exportedAt.toISOString()} format="relative" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reportFlags.length > 0 ? (
        // A summary strip, so the reader knows BEFORE scrolling that something
        // on this report is flagged. Informational: flags never block (§6.2).
        <div className="border-status-warning-subtle bg-status-warning-subtle grid gap-2 rounded-lg border p-3">
          <p className="text-label text-status-warning-text">
            {reportFlags.length} policy flag{reportFlags.length === 1 ? "" : "s"} on this
            report
          </p>
          <PolicyFlagChips flags={reportFlags} />
          <p className="text-meta text-status-warning-text">
            Your approver sees these and can approve anyway.
          </p>
        </div>
      ) : null}

      {report.reimbursements.length > 0 ? (
        <div className="border-line bg-bg-surface grid gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h3 text-text-primary">Payments</h2>
            <StatusBadge status={report.status} />
          </div>

          {/* Paid vs. balance, with the outstanding figure in the warning
              token — money still owed is not neutral information (D3.2). */}
          <PaymentProgress
            total={report.total}
            paid={report.total - outstandingBalance(report.total, report.reimbursements)}
            currency={currency}
          />

          <ul className="divide-line grid divide-y">
            {paymentViews.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                <DateCell value={p.when} tone="muted" />
                <Amount value={p.amountPaid} currency={currency} />
                <span className="text-meta text-text-secondary capitalize">{p.method}</span>
                <span className="text-meta text-text-tertiary tabular">ref {p.reference}</span>
                {p.proofUrl ? (
                  <a
                    href={p.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-text text-meta underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
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
                    <span className="text-text-tertiary">
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
                      <RemoveButton
                        reportId={report.id}
                        expenseId={e.id}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {/* Totals footer — the same figure as the header, from the same
                computeReportTotal, so a reader who scrolled can't be told a
                different number than the one at the top. */}
            <div className="border-line mt-3 flex items-center justify-between gap-4 border-t pt-3">
              <span className="text-label text-text-secondary">
                {attached.length} expense{attached.length === 1 ? "" : "s"}
              </span>
              <Amount value={runningTotal} currency={currency} align="right" />
            </div>
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
                      <span className="text-text-tertiary">
                        <DateCell value={e.date} tone="muted" /> · {e.category.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Amount value={e.amount} currency={e.currency} align="right" />
                      <AddButton
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
    </>
  );
}

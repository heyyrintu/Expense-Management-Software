// Bank reconciliation (D4.2) — DESIGN-PRD §7.6, PLAN 7.2. finance_admin+.
//
// Summary strip, then three buckets. The import wizard is a sheet behind the
// page's single primary button rather than a panel that sits on the screen
// forever: importing is an occasional task, and the reconciliation itself is
// what this route is for.
//
// Presentation only — every match, unmatch, record-payment and lock still
// goes through the server actions in ./actions.ts, with their guards, their
// state machine and their AuditLog untouched.
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ReconSummaryStrip } from "@/components/recon/summary-strip";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { outstandingBalance } from "@/lib/domain/reimbursement";
import { reconciliationSummary } from "@/lib/domain/reconcile";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ImportSheet } from "./import-sheet";
import { ReviewPanel, type BucketData } from "./review-panel";
import { StatementPicker } from "./statement-picker";

/** Payments this far outside the statement's period are still candidates —
 *  the same ±3 days the auto-matcher uses, so the buckets and the matcher
 *  consider the same set. */
const DAY_MS = 24 * 60 * 60 * 1000;
const MATCH_WINDOW_DAYS = 3;

export default async function BankReconPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const raw = await searchParams;

  const imports = (await db.bankStatementImport.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { lines: true } } },
  })) as Array<{
    id: string;
    filename: string;
    periodStart: Date;
    periodEnd: Date;
    lockedAt: Date | null;
    createdAt: Date;
    _count: { lines: number };
  }>;

  const selectedId =
    typeof raw.import === "string" && raw.import !== "" ? raw.import : imports[0]?.id;
  const current = imports.find((i) => i.id === selectedId) ?? null;
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });

  const header = (
    <PageHeader
      title="Bank reconciliation"
      description="Match statement debits against recorded payments, then lock the period."
      action={<ImportSheet />}
    />
  );

  if (!current) {
    return (
      <>
        {header}
        <EmptyState
          headline="No statements yet"
          description="Import a CSV or Excel export from your bank and every debit is matched against the payments you have already recorded."
        />
      </>
    );
  }

  const lines = (await db.bankStatementLine.findMany({
    where: { importId: current.id },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    include: {
      matchedReimbursement: {
        select: {
          id: true,
          amountPaid: true,
          reference: true,
          report: { select: { title: true, user: { select: { name: true } } } },
        },
      },
    },
  })) as Array<{
    id: string;
    date: Date;
    amount: number;
    reference: string;
    matchType: string | null;
    matchedReimbursement: {
      id: string;
      amountPaid: number;
      reference: string;
      report: { title: string; user: { name: string } };
    } | null;
  }>;

  // Recorded but unreconciled payments inside the period ±3 days. These are
  // BOTH the "Not in bank" bucket and the candidate set the match dialog
  // searches — one query, so the dialog can never offer a payment the board
  // doesn't show, or hide one it does.
  const unmatchedPayments = (await db.reimbursement.findMany({
    where: {
      bankLine: null,
      paidAt: {
        gte: new Date(current.periodStart.getTime() - MATCH_WINDOW_DAYS * DAY_MS),
        lte: new Date(current.periodEnd.getTime() + MATCH_WINDOW_DAYS * DAY_MS),
      },
    },
    orderBy: { paidAt: "asc" },
    include: { report: { select: { title: true, user: { select: { name: true } } } } },
  })) as Array<{
    id: string;
    amountPaid: number;
    paidAt: Date;
    reference: string;
    method: string;
    report: { title: string; user: { name: string } };
  }>;

  const payable = (await db.expenseReport.findMany({
    where: { status: { in: ["approved", "partially_reimbursed"] } },
    include: {
      user: { select: { name: true } },
      reimbursements: { select: { amountPaid: true } },
    },
    orderBy: { submittedAt: "asc" },
    take: 100,
  })) as Array<{
    id: string;
    title: string;
    total: number;
    user: { name: string };
    reimbursements: { amountPaid: number }[];
  }>;

  const matchedLines = lines.filter((l) => l.matchedReimbursement);
  const openLines = lines.filter((l) => !l.matchedReimbursement);
  const summary = reconciliationSummary(
    lines.length,
    matchedLines.length,
    openLines.map((l) => l.amount)
  );

  const bucket: BucketData = {
    importId: current.id,
    locked: current.lockedAt !== null,
    // Strings, not <DateCell>: this is a sentence inside a dialog title, and
    // lib/format is exactly for the non-component cases (D1.1).
    periodLabel: `${formatDate(current.periodStart)} – ${formatDate(current.periodEnd)}`,
    currency: org.currency,
    matched: matchedLines.map((l) => ({
      id: l.id,
      date: l.date.toISOString(),
      amount: l.amount,
      reference: l.reference,
      matchType: l.matchType ?? "auto",
      paymentLabel: l.matchedReimbursement
        ? `${l.matchedReimbursement.report.title} · ${l.matchedReimbursement.report.user.name}`
        : "",
    })),
    inBankOnly: openLines.map((l) => ({
      id: l.id,
      date: l.date.toISOString(),
      amount: l.amount,
      reference: l.reference,
    })),
    inAppOnly: unmatchedPayments.map((p) => ({
      id: p.id,
      date: p.paidAt.toISOString(),
      amount: p.amountPaid,
      reportTitle: p.report.title,
      ownerName: p.report.user.name,
      reference: p.reference,
    })),
    // <option> children must be text, so these labels are the one place
    // formatMoney is right rather than <Amount> (D1.1).
    payableReports: payable.map((r) => ({
      id: r.id,
      label: `${r.title} (${r.user.name}) — ${formatMoney(
        outstandingBalance(r.total, r.reimbursements),
        org.currency
      )} owing`,
    })),
    // Structured, not pre-formatted: the dialog renders amounts through
    // <Amount> and dates through <DateCell>, and searches the real fields.
    candidates: unmatchedPayments.map((p) => ({
      id: p.id,
      amount: p.amountPaid,
      date: p.paidAt.toISOString(),
      reference: p.reference,
      reportTitle: p.report.title,
      ownerName: p.report.user.name,
      method: p.method,
    })),
  };

  return (
    <>
      {header}

      <div className="grid gap-6">
        <StatementPicker
          value={current.id}
          options={imports.map((i) => ({
            id: i.id,
            label: `${i.filename} · ${formatDate(i.periodStart)}–${formatDate(i.periodEnd)} · ${i._count.lines} lines${i.lockedAt ? " · locked" : ""}`,
          }))}
        />

        <ReconSummaryStrip
          periodStart={current.periodStart.toISOString()}
          periodEnd={current.periodEnd.toISOString()}
          matchedPct={summary.matchedPct}
          unexplained={summary.unexplained}
          currency={org.currency}
          lineCount={lines.length}
        />

        <ReviewPanel data={bucket} />
      </div>
    </>
  );
}

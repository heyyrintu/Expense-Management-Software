// Bank reconciliation (7.2) — finance_admin+. Shows the latest (or chosen)
// import with the three buckets and summary; the upload/mapping wizard is a
// client panel.
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guard";
import { outstandingBalance } from "@/lib/domain/reimbursement";
import { reconciliationSummary } from "@/lib/domain/reconcile";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ImportWizard } from "./import-wizard";
import { ReviewPanel, type BucketData } from "./review-panel";

const DAY_MS = 24 * 60 * 60 * 1000;

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
  let bucket: BucketData | null = null;
  let summary: { matchedPct: number; unexplained: number } | null = null;

  if (current) {
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

    // in-app-not-in-bank: unreconciled payments inside the period ±3d
    const unmatchedPayments = (await db.reimbursement.findMany({
      where: {
        bankLine: null,
        paidAt: {
          gte: new Date(current.periodStart.getTime() - 3 * DAY_MS),
          lte: new Date(current.periodEnd.getTime() + 3 * DAY_MS),
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

    // payable reports for "record payment"
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

    const fmt = (m: number) => formatMoney(m, org.currency);
    const matchedLines = lines.filter((l) => l.matchedReimbursement);
    const openLines = lines.filter((l) => !l.matchedReimbursement);
    summary = reconciliationSummary(
      lines.length,
      matchedLines.length,
      openLines.map((l) => l.amount)
    );
    bucket = {
      importId: current.id,
      locked: current.lockedAt !== null,
      matched: matchedLines.map((l) => ({
        id: l.id,
        date: formatDate(l.date),
        amount: fmt(l.amount),
        reference: l.reference,
        matchType: l.matchType ?? "auto",
        paymentLabel: l.matchedReimbursement
          ? `${l.matchedReimbursement.report.title} (${l.matchedReimbursement.report.user.name}) · ref ${l.matchedReimbursement.reference}`
          : "",
      })),
      inBankOnly: openLines.map((l) => ({
        id: l.id,
        date: formatDate(l.date),
        amount: fmt(l.amount),
        reference: l.reference,
      })),
      inAppOnly: unmatchedPayments.map((p) => ({
        id: p.id,
        date: formatDate(p.paidAt),
        amount: fmt(p.amountPaid),
        label: `${p.report.title} (${p.report.user.name}) · ${p.method.replace("_", " ")} · ref ${p.reference}`,
      })),
      payableReports: payable
        .map((r) => ({
          id: r.id,
          label: `${r.title} (${r.user.name}) — balance ${fmt(outstandingBalance(r.total, r.reimbursements))}`,
        })),
      unmatchedPaymentOptions: unmatchedPayments.map((p) => ({
        id: p.id,
        label: `${p.report.title} · ${fmt(p.amountPaid)} · ${formatDate(p.paidAt)} · ref ${p.reference}`,
      })),
    };
  }

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Bank reconciliation</h1>
        <p className="text-muted-foreground text-sm">
          Match statement debits against recorded payments. Reconciled periods
          can be locked.
        </p>
      </div>

      <ImportWizard />

      {imports.length > 0 ? (
        <form className="flex items-end gap-2" action="/bank-recon" method="GET">
          <div className="grid gap-1">
            <label htmlFor="imp" className="text-muted-foreground text-xs">Statement</label>
            <select
              id="imp"
              name="import"
              defaultValue={selectedId}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {imports.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.filename} · {formatDate(i.periodStart)}–{formatDate(i.periodEnd)} ·{" "}
                  {i._count.lines} lines{i.lockedAt ? " · LOCKED" : ""}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="border-input h-9 rounded-md border px-3 text-sm">
            Open
          </button>
        </form>
      ) : null}

      {current && summary && bucket ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Period</CardDescription>
                <CardTitle className="text-lg">
                  {formatDate(current.periodStart)} – {formatDate(current.periodEnd)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Matched</CardDescription>
                <CardTitle className="text-lg">{summary.matchedPct}%</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Unexplained (in bank, not in app)</CardDescription>
                <CardTitle className="text-lg">
                  {formatMoney(summary.unexplained, org.currency)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
          <ReviewPanel data={bucket} />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          No statements imported yet — upload one above.
        </p>
      )}
    </section>
  );
}

import { Amount } from "@/components/ui/amount";
import { PageHeader } from "@/components/ui/page-header";
import type { PaymentProof } from "@/components/ui/payment-proof-viewer";
import { requireRole } from "@/lib/auth/guard";
import { payableQuery, summarisePayable } from "@/lib/domain/payable";
import { outstandingBalance } from "@/lib/domain/reimbursement";
import { scopedDb } from "@/lib/db/scoped";
import { signedProofUrl } from "@/lib/storage/payment-proofs";
import { RecentPayments } from "./recent-payments";
import { ReimburseQueue, type QueueRowView } from "./reimburse-queue";

type PayableRow = {
  id: string;
  title: string;
  total: number;
  status: string;
  submittedAt: Date | null;
  user: {
    name: string;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
    upiId: string | null;
  };
  reimbursements: { amountPaid: number }[];
  _count: { expenses: number };
};

type PaymentRow = {
  id: string;
  amountPaid: number;
  method: string;
  paidAt: Date;
  reference: string;
  proofKey: string | null;
  report: { title: string; user: { name: string } };
  paidBy: { name: string };
};

export default async function FinancePage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const [org, payable, recent] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.expenseReport.findMany({
      // Shared with the dashboard's "Outstanding to employees" card so the
      // two are the same SET, not two queries that happen to look alike
      // (lib/domain/payable.ts).
      ...payableQuery(),
      include: {
        // Bank fields are read ONLY to compute a presence boolean below. The
        // account number never leaves the server (CLAUDE.md) — the client
        // gets `hasBankDetails`, never a digit of it.
        user: {
          select: {
            name: true,
            bankAccountNumber: true,
            bankIfsc: true,
            upiId: true,
          },
        },
        reimbursements: { select: { amountPaid: true } },
        _count: { select: { expenses: true } },
      },
    }) as Promise<PayableRow[]>,
    db.reimbursement.findMany({
      orderBy: { paidAt: "desc" },
      take: 20,
      include: {
        report: { select: { title: true, user: { select: { name: true } } } },
        paidBy: { select: { name: true } },
      },
    }) as Promise<PaymentRow[]>,
  ]);

  const items: QueueRowView[] = payable.map((r) => {
    const paid = r.reimbursements.reduce((sum, p) => sum + p.amountPaid, 0);
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      total: r.total,
      paid,
      balance: outstandingBalance(r.total, r.reimbursements),
      ownerName: r.user.name,
      expenseCount: r._count.expenses,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      hasBankDetails: Boolean(
        (r.user.bankAccountNumber && r.user.bankIfsc) || r.user.upiId
      ),
    };
  });

  // Signed URLs only for payments fetched through the org-scoped query above.
  const payments: PaymentProof[] = await Promise.all(
    recent.map(async (p) => ({
      id: p.id,
      url: p.proofKey ? await signedProofUrl({ proofKey: p.proofKey }) : null,
      mimeType: p.proofKey?.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/jpeg",
      fileName: p.proofKey?.split("/").pop() ?? "proof",
      amountPaid: p.amountPaid,
      currency: org.currency,
      method: p.method,
      reference: p.reference,
      paidAt: p.paidAt.toISOString(),
      paidByName: p.paidBy.name,
      reportTitle: `${p.report.title} — ${p.report.user.name}`,
    }))
  );

  // Same helper the dashboard card uses, over the same rows.
  const outstandingTotal = summarisePayable(payable).outstanding;

  return (
    <>
      <PageHeader
        title="Finance"
        description="Approved and partly-paid reports waiting on a payment run."
      />

      <div className="grid gap-6">
        {items.length > 0 ? (
          <div className="border-line bg-bg-surface flex flex-wrap items-baseline justify-between gap-3 rounded-lg border p-4">
            <span className="text-label text-text-secondary">
              Outstanding to employees
            </span>
            {/* §7.4 names this the KPI finance actually watches, so it leads
                the screen at display size rather than being a column total. */}
            <Amount value={outstandingTotal} currency={org.currency} size="display" align="right" />
          </div>
        ) : null}

        <ReimburseQueue items={items} currency={org.currency} />

        {payments.length > 0 ? (
          <section className="grid gap-2">
            <h2 className="text-h2 text-text-primary">Recent payments</h2>
            <RecentPayments payments={payments} />
          </section>
        ) : null}
      </div>
    </>
  );
}

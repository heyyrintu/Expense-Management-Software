// Ledger fetcher (7.1): derives LedgerEvents from the SOURCE tables via
// scopedDb — reports (final approval), reimbursements, advances, and the
// append-only advance.settled audit rows. No stored ledger anywhere.
import type { LedgerEvent } from "@/lib/domain/ledger";
import type { ScopedDb } from "@/lib/db/scoped";

export type LedgerWindow = { from?: Date; to?: Date };

function inWindow(d: Date, w: LedgerWindow): boolean {
  if (w.from && d < w.from) return false;
  if (w.to && d > w.to) return false;
  return true;
}

export async function fetchLedgerEvents(
  db: ScopedDb,
  userId: string,
  window: LedgerWindow = {}
): Promise<{ events: LedgerEvent[]; requested: number }> {
  const [reports, payments, advances] = await Promise.all([
    db.expenseReport.findMany({
      where: {
        userId,
        status: { in: ["submitted", "approved", "partially_reimbursed", "reimbursed"] },
      },
      select: {
        id: true,
        title: true,
        total: true,
        status: true,
        submittedAt: true,
        approvals: {
          where: { action: "approved" },
          orderBy: { actedAt: "desc" },
          take: 1,
          select: { actedAt: true },
        },
      },
    }) as Promise<
      Array<{
        id: string;
        title: string;
        total: number;
        status: string;
        submittedAt: Date | null;
        approvals: Array<{ actedAt: Date }>;
      }>
    >,
    db.reimbursement.findMany({
      where: { report: { userId } },
      select: {
        id: true,
        amountPaid: true,
        paidAt: true,
        reference: true,
        method: true,
        batchId: true,
        report: { select: { title: true } },
      },
    }) as Promise<
      Array<{
        id: string;
        amountPaid: number;
        paidAt: Date;
        reference: string;
        method: string;
        batchId: string | null;
        report: { title: string };
      }>
    >,
    db.advance.findMany({
      where: {
        userId,
        status: { in: ["disbursed", "partially_settled", "settled"] },
      },
      select: {
        id: true,
        purpose: true,
        amount: true,
        disbursedAt: true,
        disbursementRef: true,
      },
    }) as Promise<
      Array<{
        id: string;
        purpose: string;
        amount: number;
        disbursedAt: Date | null;
        disbursementRef: string | null;
      }>
    >,
  ]);

  // settlements come from the append-only audit trail (6.2 writes one row
  // per allocation with the amount in meta)
  const settlements =
    advances.length === 0
      ? []
      : ((await db.auditLog.findMany({
          where: {
            entity: "Advance",
            action: "advance.settled",
            entityId: { in: advances.map((a) => a.id) },
          },
          select: { id: true, entityId: true, timestamp: true, meta: true },
        })) as Array<{ id: string; entityId: string; timestamp: Date; meta: unknown }>);

  const requested = reports.reduce((a, r) => a + r.total, 0);
  const events: LedgerEvent[] = [];

  for (const r of reports) {
    if (r.status === "submitted") continue; // requested but not yet approved
    const date = r.approvals[0]?.actedAt ?? r.submittedAt ?? new Date(0);
    if (inWindow(date, window)) {
      events.push({ kind: "report_approved", id: r.id, date, title: r.title, amount: r.total });
    }
  }
  for (const p of payments) {
    if (inWindow(p.paidAt, window)) {
      events.push({
        kind: "payment",
        id: p.id,
        date: p.paidAt,
        title: p.report.title,
        amount: p.amountPaid,
        reference: p.reference,
        method: p.method,
        batchId: p.batchId,
      });
    }
  }
  for (const a of advances) {
    const date = a.disbursedAt ?? new Date(0);
    if (inWindow(date, window)) {
      events.push({
        kind: "advance_disbursed",
        id: a.id,
        date,
        title: `Advance: ${a.purpose}`,
        amount: a.amount,
        reference: a.disbursementRef,
      });
    }
  }
  const advTitle = new Map(advances.map((a) => [a.id, a.purpose]));
  for (const s of settlements) {
    const amount =
      typeof s.meta === "object" && s.meta !== null && "amount" in s.meta
        ? Number((s.meta as { amount?: unknown }).amount)
        : NaN;
    if (!Number.isSafeInteger(amount) || amount <= 0) continue;
    if (inWindow(s.timestamp, window)) {
      events.push({
        kind: "advance_settled",
        id: s.id,
        date: s.timestamp,
        title: `Advance settled: ${advTitle.get(s.entityId) ?? ""}`,
        amount,
      });
    }
  }
  return { events, requested };
}

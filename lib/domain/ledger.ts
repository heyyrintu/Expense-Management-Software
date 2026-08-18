// Reimbursement ledger (PLAN 7.1) — a DERIVED view, never stored. Pure
// builder, unit-tested in tests/unit/ledger.test.ts.
//
// Party = the employee. From their perspective:
//   CREDIT (org owes more):  approved report totals; advance settlements
//                            (they cancel an advance debit)
//   DEBIT  (org owes less):  payments (UTR/batch); disbursed advances
// Running balance = Σcredits − Σdebits = net position (negative → refund
// due to the org). Header `outstanding` is the report-side figure and MUST
// equal approved − paid (reconciliation invariant, tested).
import { assertMinorUnits } from "@/lib/money";

export type LedgerEvent =
  | { kind: "report_approved"; id: string; date: Date; title: string; amount: number }
  | {
      kind: "payment";
      id: string;
      date: Date;
      title: string;
      amount: number;
      reference: string;
      method: string;
      batchId: string | null;
    }
  | { kind: "advance_disbursed"; id: string; date: Date; title: string; amount: number; reference: string | null }
  | { kind: "advance_settled"; id: string; date: Date; title: string; amount: number };

export type LedgerLine = {
  id: string;
  date: Date;
  type: LedgerEvent["kind"];
  description: string;
  reference: string;
  credit: number; // minor units, 0 when debit line
  debit: number;
  balance: number; // running net position after this line
};

export type LedgerTotals = {
  requested: number;
  approved: number;
  paid: number;
  /** report-side: approved − paid (the reconciliation invariant) */
  outstanding: number;
  /** net position incl. advances (final running balance) */
  netBalance: number;
};

const CREDIT_KINDS = new Set(["report_approved", "advance_settled"]);

/** Deterministic ordering: date asc, then id asc. */
export function sortEvents<T extends { date: Date; id: string }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id)
  );
}

export function buildLedger(
  events: LedgerEvent[],
  requested: number
): { lines: LedgerLine[]; totals: LedgerTotals } {
  assertMinorUnits(requested);
  let balance = 0;
  let approved = 0;
  let paid = 0;

  const lines: LedgerLine[] = sortEvents(events).map((e) => {
    assertMinorUnits(e.amount);
    const isCredit = CREDIT_KINDS.has(e.kind);
    balance += isCredit ? e.amount : -e.amount;
    if (e.kind === "report_approved") approved += e.amount;
    if (e.kind === "payment") paid += e.amount;
    return {
      id: e.id,
      date: e.date,
      type: e.kind,
      description: e.title,
      reference:
        e.kind === "payment"
          ? `${e.method.replace("_", " ")} · ${e.reference}${e.batchId ? ` · batch ${e.batchId.slice(0, 8)}` : ""}`
          : e.kind === "advance_disbursed"
            ? (e.reference ?? "")
            : "",
      credit: isCredit ? e.amount : 0,
      debit: isCredit ? 0 : e.amount,
      balance,
    };
  });

  return {
    lines,
    totals: {
      requested,
      approved,
      paid,
      outstanding: approved - paid,
      netBalance: balance,
    },
  };
}

/**
 * Proportional apportionment for project/department rollups: split `amount`
 * across weighted keys in exact integer minor units (floor shares, last
 * NON-ZERO key absorbs the remainder — same lossless discipline as splits).
 */
export function proportionalAllocate(
  amount: number,
  weights: Array<{ key: string; weight: number }>
): Map<string, number> {
  assertMinorUnits(amount);
  const total = weights.reduce((a, w) => a + w.weight, 0);
  const out = new Map<string, number>();
  if (total <= 0 || weights.length === 0) return out;
  let allocated = 0;
  weights.forEach((w, i) => {
    const share =
      i === weights.length - 1
        ? amount - allocated
        : Math.floor((amount * w.weight) / total);
    allocated += share;
    out.set(w.key, (out.get(w.key) ?? 0) + share);
  });
  return out;
}

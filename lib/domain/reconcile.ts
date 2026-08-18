// Bank reconciliation engine (PLAN 7.2) — pure, unit-tested in
// tests/unit/reconcile.test.ts.
import { assertMinorUnits } from "@/lib/money";

export type ColumnMapping = { dateCol: number; amountCol: number; referenceCol: number };

export type StatementLine = { date: Date; amount: number; reference: string };

/** dd/mm/yyyy PRIORITY (Indian bank statements), then yyyy-mm-dd, then
 *  dd-Mon-yyyy ("05-Aug-2026"). */
export function parseStatementDate(s: string): Date | null {
  const t = s.trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t); // dd/mm/yyyy first
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1] ? d : null;
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
  }
  m = /^(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s](\d{4})$/.exec(t);
  if (m) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const mi = months.indexOf(m[2].toLowerCase());
    if (mi < 0) return null;
    const d = new Date(Date.UTC(+m[3], mi, +m[1]));
    return d.getUTCDate() === +m[1] ? d : null;
  }
  return null;
}

export function parseStatementAmount(s: string): number | null {
  const cleaned = s.replace(/[₹$€£,\s]/g, "").replace(/(dr|cr)$/i, "");
  const m = /^(-?)(\d{1,13})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const minor =
    Number.parseInt(m[2], 10) * 100 + (m[3] ? Number.parseInt(m[3].padEnd(2, "0"), 10) : 0);
  if (!Number.isSafeInteger(minor)) return null;
  return m[1] === "-" ? -minor : minor;
}

/** Apply a column mapping to raw rows (header row excluded by the caller). */
export function parseStatementRows(
  rows: string[][],
  mapping: ColumnMapping
): { lines: StatementLine[]; skipped: Array<{ row: number; reason: string }> } {
  const lines: StatementLine[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  rows.forEach((cells, i) => {
    const date = parseStatementDate(String(cells[mapping.dateCol] ?? ""));
    const amount = parseStatementAmount(String(cells[mapping.amountCol] ?? ""));
    const reference = String(cells[mapping.referenceCol] ?? "").trim();
    if (!date) skipped.push({ row: i + 2, reason: "unreadable date" });
    else if (amount === null) skipped.push({ row: i + 2, reason: "unreadable amount" });
    else if (amount <= 0) skipped.push({ row: i + 2, reason: "credit or zero" });
    else lines.push({ date, amount, reference });
  });
  return { lines, skipped };
}

/** Header-name heuristics to prefill the mapping step. */
export function suggestMapping(headers: string[]): Partial<ColumnMapping> {
  const lower = headers.map((h) => h.toLowerCase());
  // needles are in PRIORITY order: the first needle that matches any header
  // wins (e.g. a "UTR" column beats a generic "Narration")
  const find = (...needles: string[]) => {
    for (const n of needles) {
      const idx = lower.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const dateCol = find("date");
  const amountCol = find("debit", "withdrawal", "amount");
  const referenceCol = find("utr", "reference", "narration", "description", "particular");
  return {
    ...(dateCol >= 0 ? { dateCol } : {}),
    ...(amountCol >= 0 ? { amountCol } : {}),
    ...(referenceCol >= 0 ? { referenceCol } : {}),
  };
}

// ---------- matching ----------

export type PaymentCandidate = {
  id: string;
  amountPaid: number;
  paidAt: Date;
  reference: string;
};

export type MatchResult = Map<number, { paymentId: string; pass: 1 | 2 }>;

const DAY_MS = 24 * 60 * 60 * 1000;
const MATCH_WINDOW_DAYS = 3;
const MIN_REF_LEN = 8;

function normRef(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Two passes, never double-matching either side:
 *  1. UTR/reference exact (normalized equality, or the bank narration
 *     containing a payment reference of ≥8 chars) — skipped when ambiguous.
 *  2. amount + date ±3 days — ONLY when the pairing is unambiguous in BOTH
 *     directions (one candidate payment for the line, and that payment fits
 *     no other unmatched line).
 */
export function autoReconcile(
  lines: StatementLine[],
  payments: PaymentCandidate[]
): MatchResult {
  const result: MatchResult = new Map();
  const usedPayments = new Set<string>();

  // pass 1 — reference
  lines.forEach((line, i) => {
    const lineRef = normRef(line.reference);
    if (lineRef === "") return;
    const candidates = payments.filter((p) => {
      if (usedPayments.has(p.id)) return false;
      const pRef = normRef(p.reference);
      if (pRef === "") return false;
      return pRef === lineRef || (pRef.length >= MIN_REF_LEN && lineRef.includes(pRef));
    });
    if (candidates.length === 1) {
      result.set(i, { paymentId: candidates[0].id, pass: 1 });
      usedPayments.add(candidates[0].id);
    } // 0 or >1 → leave for pass 2 / manual
  });

  // pass 2 — amount + date window, unambiguous both ways
  const openLineIdxs = lines
    .map((_, i) => i)
    .filter((i) => !result.has(i));
  for (const i of openLineIdxs) {
    const line = lines[i];
    const candidates = payments.filter(
      (p) =>
        !usedPayments.has(p.id) &&
        p.amountPaid === line.amount &&
        Math.abs(p.paidAt.getTime() - line.date.getTime()) <= MATCH_WINDOW_DAYS * DAY_MS
    );
    if (candidates.length !== 1) continue;
    const payment = candidates[0];
    // reverse check: does this payment fit any OTHER open line?
    const rivals = openLineIdxs.filter(
      (j) =>
        j !== i &&
        !result.has(j) &&
        lines[j].amount === payment.amountPaid &&
        Math.abs(payment.paidAt.getTime() - lines[j].date.getTime()) <=
          MATCH_WINDOW_DAYS * DAY_MS
    );
    if (rivals.length > 0) continue; // ambiguous — manual review
    result.set(i, { paymentId: payment.id, pass: 2 });
    usedPayments.add(payment.id);
  }
  return result;
}

/** Reconciliation summary numbers. */
export function reconciliationSummary(
  totalLines: number,
  matchedLines: number,
  unmatchedLineAmounts: number[]
): { matchedPct: number; unexplained: number } {
  let unexplained = 0;
  for (const a of unmatchedLineAmounts) {
    assertMinorUnits(a);
    unexplained += a;
  }
  return {
    matchedPct: totalLines === 0 ? 100 : Math.floor((matchedLines / totalLines) * 100),
    unexplained,
  };
}

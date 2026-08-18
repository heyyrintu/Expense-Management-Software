// Pure dashboard aggregations — integer minor units throughout.
// Unit-tested in tests/unit/dashboard.test.ts.
import { assertMinorUnits } from "@/lib/money";

export type ExpenseAggRow = {
  amount: number;
  date: Date;
  status: string;
  merchant: string;
  categoryId: string;
  projectId: string | null;
  userId: string;
  departmentId: string | null;
  flagCount: number;
};

export function sumAmounts(rows: { amount: number }[]): number {
  let total = 0;
  for (const r of rows) {
    assertMinorUnits(r.amount);
    total += r.amount;
  }
  return total;
}

/** yyyy-mm key in UTC. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Last `n` month keys ending at `now`'s month, oldest first. */
export function lastMonthKeys(now: Date, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

/** Monthly totals over the given keys (zero-filled). */
export function monthlyTotals(
  rows: Pick<ExpenseAggRow, "amount" | "date">[],
  keys: string[]
): Array<{ month: string; total: number }> {
  const map = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const k = monthKey(r.date);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + r.amount);
  }
  return keys.map((k) => ({ month: k, total: map.get(k) ?? 0 }));
}

/** Totals grouped by an arbitrary key, descending, with labels resolved. */
export function totalsBy<K extends string | null>(
  rows: ExpenseAggRow[],
  key: (r: ExpenseAggRow) => K,
  label: (k: K) => string
): Array<{ key: string; label: string; total: number; count: number }> {
  const map = new Map<string, { label: string; total: number; count: number }>();
  for (const r of rows) {
    const k = key(r);
    const id = k === null ? "—" : String(k);
    const entry = map.get(id) ?? { label: label(k), total: 0, count: 0 };
    entry.total += r.amount;
    entry.count += 1;
    map.set(id, entry);
  }
  return [...map.entries()]
    .map(([id, v]) => ({ key: id, ...v }))
    .sort((a, b) => b.total - a.total);
}

/** Top merchants (case-insensitive merge, first-seen casing wins). */
export function topMerchants(
  rows: Pick<ExpenseAggRow, "amount" | "merchant">[],
  n: number
): Array<{ merchant: string; total: number; count: number }> {
  const map = new Map<string, { merchant: string; total: number; count: number }>();
  for (const r of rows) {
    const k = r.merchant.trim().toLowerCase();
    const entry = map.get(k) ?? { merchant: r.merchant.trim(), total: 0, count: 0 };
    entry.total += r.amount;
    entry.count += 1;
    map.set(k, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

export function countViolations(rows: Pick<ExpenseAggRow, "flagCount">[]): number {
  return rows.reduce((acc, r) => acc + (r.flagCount > 0 ? 1 : 0), 0);
}

/** Average ms between submission and final approval; null when no data. */
export function avgApprovalMs(
  pairs: Array<{ submittedAt: Date; decidedAt: Date }>
): number | null {
  const valid = pairs.filter((p) => p.decidedAt.getTime() >= p.submittedAt.getTime());
  if (valid.length === 0) return null;
  const total = valid.reduce(
    (acc, p) => acc + (p.decidedAt.getTime() - p.submittedAt.getTime()),
    0
  );
  return Math.round(total / valid.length);
}

export function formatDurationMs(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60000))} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

// ---------- CSV ----------

/** Excel-safe cell: quotes doubled, formula injection neutralised. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(header: string[], rows: Array<Array<string | number>>): string {
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

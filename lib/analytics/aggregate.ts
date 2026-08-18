// Pure analytics aggregations (6.7) — unit-tested against fixtures in
// tests/unit/analytics.test.ts.
import { lastMonthKeys, monthKey } from "@/lib/domain/dashboard";
import type { AnalyticsRow } from "./index";

export type Dimension = "category" | "department" | "project";

function labelOf(row: AnalyticsRow, dim: Dimension): string {
  if (dim === "category") return row.categoryName;
  if (dim === "department") return row.departmentName ?? "No department";
  return row.projectName ?? "No project";
}

export const TREND_TOP_N = 5;

/**
 * 12-month stacked series by dimension: top-N labels by total, the rest
 * folded into "Other". Every month zero-filled — chart totals reconcile
 * exactly with sum(rows).
 */
export function monthlySeriesByDimension(
  rows: AnalyticsRow[],
  dim: Dimension,
  now: Date,
  monthsBack = 12
): { months: string[]; labels: string[]; series: Array<Record<string, number | string>> } {
  const months = lastMonthKeys(now, monthsBack);
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(labelOf(r, dim), (totals.get(labelOf(r, dim)) ?? 0) + r.baseAmount);
  const top = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TREND_TOP_N)
    .map(([label]) => label);
  const labels = totals.size > top.length ? [...top, "Other"] : top;

  const byMonth = new Map<string, Record<string, number>>(
    months.map((m) => [m, Object.fromEntries(labels.map((l) => [l, 0]))])
  );
  for (const r of rows) {
    const mk = monthKey(r.date);
    const bucket = byMonth.get(mk);
    if (!bucket) continue;
    const raw = labelOf(r, dim);
    const label = top.includes(raw) ? raw : "Other";
    if (label in bucket) bucket[label] += r.baseAmount;
  }
  return {
    months,
    labels,
    series: months.map((m) => ({ month: m, ...byMonth.get(m)! })),
  };
}

export type ViolationEntry = { rule: string; message?: string };

function rowFlags(row: AnalyticsRow): ViolationEntry[] {
  if (!Array.isArray(row.flags)) return [];
  return (row.flags as unknown[]).filter(
    (f): f is ViolationEntry =>
      typeof f === "object" && f !== null && typeof (f as ViolationEntry).rule === "string"
  );
}

/** Violations by type and by user; drill-down uses the same rows. */
export function violationLeaderboard(rows: AnalyticsRow[]): {
  byType: Array<{ rule: string; count: number }>;
  byUser: Array<{ userId: string; userName: string; count: number; total: number }>;
} {
  const byType = new Map<string, number>();
  const byUser = new Map<string, { userName: string; count: number; total: number }>();
  for (const r of rows) {
    const flags = rowFlags(r);
    if (flags.length === 0) continue;
    for (const f of flags) byType.set(f.rule, (byType.get(f.rule) ?? 0) + 1);
    const u = byUser.get(r.userId) ?? { userName: r.userName, count: 0, total: 0 };
    u.count += 1; // flagged EXPENSES per user
    u.total += r.baseAmount;
    byUser.set(r.userId, u);
  }
  return {
    byType: [...byType.entries()]
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count),
    byUser: [...byUser.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.count - a.count || b.total - a.total),
  };
}

/** Flagged rows, optionally filtered — the leaderboard's drill-down. */
export function flaggedRows(
  rows: AnalyticsRow[],
  filter?: { rule?: string; userId?: string }
): AnalyticsRow[] {
  return rows.filter((r) => {
    const flags = rowFlags(r);
    if (flags.length === 0) return false;
    if (filter?.userId && r.userId !== filter.userId) return false;
    if (filter?.rule && !flags.some((f) => f.rule === filter.rule)) return false;
    return true;
  });
}

/** Nearest-rank percentile on ms durations; null for empty. */
export function percentile(valuesMs: number[], p: number): number | null {
  if (valuesMs.length === 0) return null;
  const sorted = [...valuesMs].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export type DecisionSample = {
  approverId: string;
  approverName: string;
  submittedAt: Date;
  decidedAt: Date;
};

/** Avg + p90 decision time per approver. */
export function approverBottlenecks(samples: DecisionSample[]): Array<{
  approverId: string;
  approverName: string;
  count: number;
  avgMs: number;
  p90Ms: number;
}> {
  const byApprover = new Map<string, { name: string; durations: number[] }>();
  for (const s of samples) {
    const ms = s.decidedAt.getTime() - s.submittedAt.getTime();
    if (ms < 0) continue; // clock skew
    const entry = byApprover.get(s.approverId) ?? { name: s.approverName, durations: [] };
    entry.durations.push(ms);
    byApprover.set(s.approverId, entry);
  }
  return [...byApprover.entries()]
    .map(([approverId, v]) => ({
      approverId,
      approverName: v.name,
      count: v.durations.length,
      avgMs: Math.round(v.durations.reduce((a, b) => a + b, 0) / v.durations.length),
      p90Ms: percentile(v.durations, 90)!,
    }))
    .sort((a, b) => b.avgMs - a.avgMs);
}

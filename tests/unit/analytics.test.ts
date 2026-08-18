import { describe, expect, it } from "vitest";
import {
  approverBottlenecks,
  flaggedRows,
  monthlySeriesByDimension,
  percentile,
  violationLeaderboard,
} from "@/lib/analytics/aggregate";
import type { AnalyticsRow } from "@/lib/analytics";

const row = (over: Partial<AnalyticsRow> = {}): AnalyticsRow => ({
  id: "e1",
  baseAmount: 1000,
  date: new Date("2026-08-10T00:00:00.000Z"),
  status: "submitted",
  merchant: "Uber",
  flags: [],
  userId: "u1",
  userName: "Priya",
  categoryId: "c1",
  categoryName: "Travel",
  departmentId: "d1",
  departmentName: "Engineering",
  projectId: null,
  projectName: null,
  ...over,
});

const now = new Date("2026-08-18T00:00:00.000Z");

describe("monthlySeriesByDimension", () => {
  it("pivots by month × label, zero-filled, and reconciles with the row sum", () => {
    const rows = [
      row({ baseAmount: 100, categoryName: "Travel" }),
      row({ baseAmount: 200, categoryName: "Meals", date: new Date("2026-07-01T00:00:00.000Z") }),
      row({ baseAmount: 300, categoryName: "Travel", date: new Date("2026-07-15T00:00:00.000Z") }),
    ];
    const { months, labels, series } = monthlySeriesByDimension(rows, "category", now, 3);
    expect(months).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(labels.sort()).toEqual(["Meals", "Travel"]);
    const chartTotal = series.reduce(
      (acc, m) => acc + labels.reduce((a, l) => a + Number(m[l] ?? 0), 0),
      0
    );
    expect(chartTotal).toBe(600); // exact reconciliation
    expect(series[1]).toMatchObject({ month: "2026-07", Travel: 300, Meals: 200 });
  });

  it("folds beyond top-5 into Other", () => {
    const rows = ["A", "B", "C", "D", "E", "F", "G"].map((name, i) =>
      row({ id: `e${i}`, categoryName: name, baseAmount: (7 - i) * 100 })
    );
    const { labels, series } = monthlySeriesByDimension(rows, "category", now, 1);
    expect(labels).toHaveLength(6);
    expect(labels).toContain("Other");
    expect(Number(series[0].Other)).toBe(300); // F(200) + G(100)
  });

  it("null department/project label gracefully", () => {
    const { labels } = monthlySeriesByDimension([row({ departmentName: null })], "department", now, 1);
    expect(labels).toEqual(["No department"]);
  });
});

describe("violationLeaderboard + drill-down", () => {
  const rows = [
    row({ id: "a", flags: [{ rule: "duplicate", message: "x" }] }),
    row({ id: "b", userId: "u2", userName: "Asha", flags: [{ rule: "duplicate" }, { rule: "expense_age" }], baseAmount: 5000 }),
    row({ id: "c", flags: [] }),
  ];

  it("counts by type and by user; drill-down returns the same rows", () => {
    const lb = violationLeaderboard(rows);
    expect(lb.byType).toEqual([
      { rule: "duplicate", count: 2 },
      { rule: "expense_age", count: 1 },
    ]);
    expect(lb.byUser[0]).toMatchObject({ userId: "u2", count: 1, total: 5000 });
    // reconciliation: drill-down for each leaderboard cell matches its count
    expect(flaggedRows(rows, { rule: "duplicate" })).toHaveLength(2);
    expect(flaggedRows(rows, { userId: "u2" })).toHaveLength(1);
    expect(flaggedRows(rows, { rule: "expense_age", userId: "u1" })).toHaveLength(0);
  });
});

describe("bottlenecks", () => {
  const HOUR = 3600_000;
  it("percentile nearest-rank incl. edges", () => {
    expect(percentile([], 90)).toBeNull();
    expect(percentile([5], 90)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([1, 2], 50)).toBe(1);
  });
  it("avg + p90 per approver, slowest first, skew ignored", () => {
    const t0 = new Date("2026-08-01T00:00:00.000Z");
    const at = (h: number) => new Date(t0.getTime() + h * HOUR);
    const out = approverBottlenecks([
      { approverId: "a1", approverName: "Slow", submittedAt: t0, decidedAt: at(10) },
      { approverId: "a1", approverName: "Slow", submittedAt: t0, decidedAt: at(20) },
      { approverId: "a2", approverName: "Fast", submittedAt: t0, decidedAt: at(1) },
      { approverId: "a2", approverName: "Fast", submittedAt: at(5), decidedAt: at(4) }, // skew — dropped
    ]);
    expect(out[0]).toMatchObject({ approverId: "a1", count: 2, avgMs: 15 * HOUR, p90Ms: 20 * HOUR });
    expect(out[1]).toMatchObject({ approverId: "a2", count: 1, avgMs: 1 * HOUR });
  });
});

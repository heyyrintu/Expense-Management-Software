import { describe, expect, it } from "vitest";
import {
  avgApprovalMs,
  buildCsv,
  countViolations,
  csvCell,
  formatDurationMs,
  lastMonthKeys,
  monthKey,
  monthlyTotals,
  sumAmounts,
  topMerchants,
  totalsBy,
  type ExpenseAggRow,
} from "@/lib/domain/dashboard";
import { buildExpenseWhere } from "@/lib/domain/expense-query";

const row = (over: Partial<ExpenseAggRow> = {}): ExpenseAggRow => ({
  amount: 1000,
  date: new Date("2026-08-10T00:00:00.000Z"),
  status: "draft",
  merchant: "Uber",
  categoryId: "c1",
  projectId: null,
  userId: "u1",
  departmentId: null,
  flagCount: 0,
  ...over,
});

describe("monthly aggregation", () => {
  it("zero-fills months and buckets by UTC month, year rollover included", () => {
    const keys = lastMonthKeys(new Date("2026-02-15T00:00:00.000Z"), 4);
    expect(keys).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    const totals = monthlyTotals(
      [
        row({ date: new Date("2025-12-31T00:00:00.000Z"), amount: 100 }),
        row({ date: new Date("2026-01-01T00:00:00.000Z"), amount: 200 }),
        row({ date: new Date("2026-01-15T00:00:00.000Z"), amount: 300 }),
        row({ date: new Date("2024-01-01T00:00:00.000Z"), amount: 999 }), // outside window
      ],
      keys
    );
    expect(totals).toEqual([
      { month: "2025-11", total: 0 },
      { month: "2025-12", total: 100 },
      { month: "2026-01", total: 500 },
      { month: "2026-02", total: 0 },
    ]);
  });
  it("monthKey pads", () => {
    expect(monthKey(new Date("2026-03-05T00:00:00.000Z"))).toBe("2026-03");
  });
});

describe("totalsBy / topMerchants / violations", () => {
  it("groups, counts, sorts desc, resolves labels incl. null key", () => {
    const rows = [
      row({ projectId: "p1", amount: 100 }),
      row({ projectId: "p1", amount: 300 }),
      row({ projectId: null, amount: 250 }),
    ];
    const out = totalsBy(rows, (r) => r.projectId, (k) => (k === null ? "No project" : "P"));
    expect(out[0]).toEqual({ key: "p1", label: "P", total: 400, count: 2 });
    expect(out[1]).toEqual({ key: "—", label: "No project", total: 250, count: 1 });
  });

  it("merchants merge case-insensitively", () => {
    const out = topMerchants(
      [
        row({ merchant: "Uber", amount: 100 }),
        row({ merchant: "UBER ", amount: 200 }),
        row({ merchant: "Ola", amount: 250 }),
      ],
      5
    );
    expect(out[0]).toEqual({ merchant: "Uber", total: 300, count: 2 });
    expect(out[1].merchant).toBe("Ola");
  });

  it("violations count expenses with any flag", () => {
    expect(countViolations([row(), row({ flagCount: 2 }), row({ flagCount: 1 })])).toBe(2);
  });

  it("sumAmounts rejects floats", () => {
    expect(() => sumAmounts([{ amount: 10.5 }])).toThrow();
  });
});

describe("avg approval time", () => {
  it("averages valid pairs, ignores negatives, null on empty", () => {
    expect(avgApprovalMs([])).toBeNull();
    const hour = 60 * 60 * 1000;
    const ms = avgApprovalMs([
      { submittedAt: new Date(0), decidedAt: new Date(2 * hour) },
      { submittedAt: new Date(0), decidedAt: new Date(4 * hour) },
      { submittedAt: new Date(hour), decidedAt: new Date(0) }, // clock skew — ignored
    ]);
    expect(ms).toBe(3 * hour);
    expect(formatDurationMs(3 * hour)).toBe("3.0 h");
    expect(formatDurationMs(3 * 24 * hour)).toBe("3.0 days");
  });
});

describe("CSV", () => {
  it("escapes quotes/commas/newlines and neutralises formulas", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+91 12345")).toBe("'+91 12345");
    const csv = buildCsv(["a", "b"], [["1", "x,y"]]);
    expect(csv).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("buildExpenseWhere — scope pinning", () => {
  it("employee scope always pins userId regardless of filters", () => {
    const w = buildExpenseWhere(
      { kind: "employee", userId: "me" },
      { departmentId: "d1", status: "approved" }
    );
    expect(w.userId).toBe("me");
  });
  it("team scope pins the direct-report id list", () => {
    const w = buildExpenseWhere({ kind: "team", teamUserIds: ["a", "b"] }, {});
    expect(w.userId).toEqual({ in: ["a", "b"] });
  });
  it("org scope adds no user pin; filters map to fields", () => {
    const w = buildExpenseWhere(
      { kind: "org" },
      { from: "2026-08-01", to: "2026-08-31", categoryId: "c", projectId: "p" }
    );
    expect(w.userId).toBeUndefined();
    expect(w.categoryId).toBe("c");
    expect(w.projectId).toBe("p");
    expect((w.date as { gte: Date }).gte.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

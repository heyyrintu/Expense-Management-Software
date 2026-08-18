import { describe, expect, it } from "vitest";
import {
  splitsFromAmounts,
  splitsFromPercents,
  splitsSumExactly,
} from "@/lib/domain/expense-split";
import { evaluateSplitLimits } from "@/lib/domain/policy";

const row = (value: string, categoryId = "c1", projectId = "") => ({
  categoryId,
  projectId,
  value,
});

describe("splitsFromAmounts — exact-sum invariant", () => {
  it("accepts lines summing exactly to the total", () => {
    const r = splitsFromAmounts(10000, [row("60.00"), row("40.00", "c2", "p1")]);
    if ("error" in r) throw new Error(r.error);
    expect(r.splits.map((s) => s.amount)).toEqual([6000, 4000]);
    expect(r.splits[1].projectId).toBe("p1");
  });
  it("rejects mismatched sums, zero lines, single line", () => {
    expect("error" in splitsFromAmounts(10000, [row("60.00"), row("40.01")])).toBe(true);
    expect("error" in splitsFromAmounts(10000, [row("100.00"), row("0")])).toBe(true);
    expect("error" in splitsFromAmounts(10000, [row("100.00")])).toBe(true);
  });
});

describe("splitsFromPercents — remainder absorption", () => {
  it("floors shares; last line absorbs the remainder — sum is exact", () => {
    // 100.01 split 3 ways: 33% = 3300 (floor of 3300.33), 33% = 3300, last 34% absorbs
    const r = splitsFromPercents(10001, [
      { categoryId: "a", projectId: "", percent: 33 },
      { categoryId: "b", projectId: "", percent: 33 },
      { categoryId: "c", projectId: "", percent: 34 },
    ]);
    if ("error" in r) throw new Error(r.error);
    expect(r.splits.map((s) => s.amount)).toEqual([3300, 3300, 3401]);
    expect(r.splits.reduce((a, s) => a + s.amount, 0)).toBe(10001);
  });
  it("50/50 of an odd amount loses nothing", () => {
    const r = splitsFromPercents(10001, [
      { categoryId: "a", projectId: "", percent: 50 },
      { categoryId: "b", projectId: "", percent: 50 },
    ]);
    if ("error" in r) throw new Error(r.error);
    expect(r.splits.map((s) => s.amount)).toEqual([5000, 5001]);
  });
  it("rejects percents not totalling 100, fractions, and out-of-range", () => {
    expect("error" in splitsFromPercents(10000, [
      { categoryId: "a", projectId: "", percent: 60 },
      { categoryId: "b", projectId: "", percent: 30 },
    ])).toBe(true);
    expect("error" in splitsFromPercents(10000, [
      { categoryId: "a", projectId: "", percent: 50.5 as number },
      { categoryId: "b", projectId: "", percent: 49.5 as number },
    ])).toBe(true);
    expect("error" in splitsFromPercents(10000, [
      { categoryId: "a", projectId: "", percent: 100 },
      { categoryId: "b", projectId: "", percent: 0 },
    ])).toBe(true);
  });
});

describe("splitsSumExactly", () => {
  it("defensive re-check", () => {
    expect(splitsSumExactly(100, [
      { categoryId: "a", projectId: null, amount: 60 },
      { categoryId: "b", projectId: null, amount: 40 },
    ])).toBe(true);
    expect(splitsSumExactly(100, [
      { categoryId: "a", projectId: null, amount: 60 },
      { categoryId: "b", projectId: null, amount: 41 },
    ])).toBe(false);
    expect(splitsSumExactly(100, [
      { categoryId: "a", projectId: null, amount: 100 },
      { categoryId: "b", projectId: null, amount: 0 },
    ])).toBe(false);
  });
});

describe("evaluateSplitLimits — policy per split", () => {
  const fmt = (m: number) => `₹${(m / 100).toFixed(2)}`;
  const ctx = new Map([
    ["travel", { limits: { perExpenseLimit: 5000, monthlyLimit: 20000, receiptRequiredAbove: null }, monthlySpent: 0, categoryName: "Travel" }],
    ["meals", { limits: { perExpenseLimit: null, monthlyLimit: 10000, receiptRequiredAbove: null }, monthlySpent: 9000, categoryName: "Meals" }],
  ]);

  it("flags each split against its own category limits, message names the category", () => {
    const flags = evaluateSplitLimits(
      [
        { categoryId: "travel", amount: 6000 }, // over per-expense
        { categoryId: "meals", amount: 2000 }, // 9000+2000 > 10000 monthly
      ],
      ctx,
      fmt
    );
    expect(flags.map((f) => f.rule).sort()).toEqual(["monthly_limit", "per_expense_limit"]);
    expect(flags.find((f) => f.rule === "per_expense_limit")?.message).toContain("Travel");
    expect(flags.find((f) => f.rule === "monthly_limit")?.message).toContain("Meals");
  });

  it("aggregates multiple splits in the same category before checking", () => {
    const flags = evaluateSplitLimits(
      [
        { categoryId: "travel", amount: 3000 },
        { categoryId: "travel", amount: 3000 }, // together 6000 > 5000
      ],
      ctx,
      fmt
    );
    expect(flags.map((f) => f.rule)).toContain("per_expense_limit");
  });

  it("within limits and unknown categories produce nothing", () => {
    expect(
      evaluateSplitLimits([{ categoryId: "travel", amount: 4000 }], ctx, fmt)
    ).toHaveLength(0);
    expect(
      evaluateSplitLimits([{ categoryId: "ghost", amount: 999999 }], ctx, fmt)
    ).toHaveLength(0);
  });
});

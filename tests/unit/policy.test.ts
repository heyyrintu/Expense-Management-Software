import { describe, expect, it } from "vitest";
import {
  evaluateExpense,
  isDuplicateOf,
  monthWindow,
  requiresReceipt,
  type CategoryLimits,
  type ExpenseForPolicy,
  type ExpenseTypeForPolicy,
  type PolicyContext,
  type PolicyFlag,
} from "@/lib/domain/policy";

const fmt = (minor: number) => `₹${(minor / 100).toFixed(2)}`;

function ctx(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    category: {
      perExpenseLimit: 100000, // ₹1,000
      monthlyLimit: 500000, // ₹5,000
      receiptRequiredAbove: 50000, // ₹500
    },
    monthlySpent: 0,
    duplicateCandidates: [],
    maxAgeDays: 90,
    now: new Date("2026-08-18T00:00:00.000Z"),
    formatAmount: fmt,
    ...overrides,
  };
}

const expense = (over: Partial<Parameters<typeof evaluateExpense>[0]> = {}) => ({
  baseAmount: 10000,
  originalAmount: 10000,
  date: new Date("2026-08-10T00:00:00.000Z"),
  merchant: "Uber",
  receiptCount: 1,
  ...over,
});

const rules = (flags: PolicyFlag[]) => flags.map((f) => f.rule).sort();

describe("per_expense_limit", () => {
  it("flags strictly above the limit, not at it", () => {
    expect(rules(evaluateExpense(expense({ baseAmount: 100001 }), ctx()))).toContain("per_expense_limit");
    expect(rules(evaluateExpense(expense({ baseAmount: 100000 }), ctx()))).not.toContain("per_expense_limit");
  });
  it("silent when the category has no limit or no category", () => {
    expect(
      evaluateExpense(expense({ baseAmount: 9999999 }), ctx({ category: { perExpenseLimit: null, monthlyLimit: null, receiptRequiredAbove: null } }))
    ).toHaveLength(0);
    expect(evaluateExpense(expense({ baseAmount: 9999999 }), ctx({ category: null }))).toHaveLength(0);
  });
});

describe("monthly_limit", () => {
  it("flags when prior spend + this expense crosses the limit", () => {
    expect(rules(evaluateExpense(expense({ baseAmount: 100000 }), ctx({ monthlySpent: 400001 })))).toContain("monthly_limit");
    expect(rules(evaluateExpense(expense({ baseAmount: 100000 }), ctx({ monthlySpent: 400000 })))).not.toContain("monthly_limit");
  });
});

describe("receipt_required", () => {
  it("flags above threshold with zero receipts; a receipt clears it", () => {
    expect(rules(evaluateExpense(expense({ baseAmount: 50001, receiptCount: 0 }), ctx()))).toContain("receipt_required");
    expect(rules(evaluateExpense(expense({ baseAmount: 50001, receiptCount: 1 }), ctx()))).not.toContain("receipt_required");
    expect(rules(evaluateExpense(expense({ baseAmount: 50000, receiptCount: 0 }), ctx()))).not.toContain("receipt_required");
  });
});

describe("expense_age", () => {
  it("flags strictly older than the limit; boundary day passes", () => {
    // 2026-08-18 minus 90 days = 2026-05-20
    expect(
      rules(evaluateExpense(expense({ date: new Date("2026-05-19T00:00:00.000Z") }), ctx()))
    ).toContain("expense_age");
    expect(
      rules(evaluateExpense(expense({ date: new Date("2026-05-20T00:00:00.000Z") }), ctx()))
    ).not.toContain("expense_age");
  });
  it("disabled when maxAgeDays is null", () => {
    expect(
      evaluateExpense(expense({ date: new Date("2020-01-01") }), ctx({ maxAgeDays: null }))
    ).toHaveLength(0);
  });
});

describe("duplicate", () => {
  const d = new Date("2026-08-10T00:00:00.000Z");
  it("same amount + date + merchant (case-insensitive) flags", () => {
    const c = ctx({ duplicateCandidates: [{ amount: 10000, date: d, merchant: "UBER " }] });
    expect(rules(evaluateExpense(expense(), c))).toContain("duplicate");
  });
  it("any differing field is not a duplicate", () => {
    for (const cand of [
      { amount: 10001, date: d, merchant: "Uber" },
      { amount: 10000, date: new Date("2026-08-11T00:00:00.000Z"), merchant: "Uber" },
      { amount: 10000, date: d, merchant: "Ola" },
    ]) {
      expect(isDuplicateOf(expense(), cand), JSON.stringify(cand)).toBe(false);
    }
  });
});

describe("combinations", () => {
  it("multiple violations stack; each carries a human message", () => {
    const flags = evaluateExpense(
      expense({
        baseAmount: 200000,
        originalAmount: 200000,
        receiptCount: 0,
        date: new Date("2026-01-01T00:00:00.000Z"),
      }),
      ctx({
        monthlySpent: 500000,
        duplicateCandidates: [
          { amount: 200000, date: new Date("2026-01-01T00:00:00.000Z"), merchant: "uber" },
        ],
      })
    );
    expect(rules(flags)).toEqual([
      "duplicate",
      "expense_age",
      "monthly_limit",
      "per_expense_limit",
      "receipt_required",
    ]);
    for (const f of flags) expect(f.message.length).toBeGreaterThan(5);
  });

  it("a clean expense produces zero flags", () => {
    expect(evaluateExpense(expense(), ctx())).toHaveLength(0);
  });
});

describe("monthWindow", () => {
  it("spans the UTC month including year rollover", () => {
    const w = monthWindow(new Date("2026-12-15T00:00:00.000Z"));
    expect(w.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Receipt exemption by expense type (PRD P1, per-diem)
//
// A per-diem is an allowance paid at the org's published rate. There is no
// vendor, no transaction and therefore no receipt in existence — flagging one
// for a missing receipt would ask for a document that cannot be obtained, on
// every single claim, until approvers stopped reading the flag column.
//
// The exemption is narrow on purpose: it removes ONE rule and leaves the rest.
// ---------------------------------------------------------------------------
describe("receipt-required exemption by type", () => {
  const LIMITS: CategoryLimits = {
    perExpenseLimit: null,
    monthlyLimit: null,
    receiptRequiredAbove: 100_000, // ₹1,000
  };

  const ctx = (over: Partial<PolicyContext> = {}): PolicyContext => ({
    category: LIMITS,
    monthlySpent: 0,
    duplicateCandidates: [],
    maxAgeDays: null,
    now: new Date("2026-08-20T00:00:00.000Z"),
    formatAmount: (m) => `₹${(m / 100).toFixed(2)}`,
    ...over,
  });

  const expense = (type?: ExpenseTypeForPolicy): ExpenseForPolicy => ({
    baseAmount: 500_000, // well above the threshold
    originalAmount: 500_000,
    date: new Date("2026-08-18T00:00:00.000Z"),
    merchant: "Per diem — Metro",
    receiptCount: 0,
    type,
  });

  it("flags a regular expense with no receipt", () => {
    const flags = evaluateExpense(expense("regular"), ctx());
    expect(flags.map((f) => f.rule)).toContain("receipt_required");
  });

  it("defaults to requiring a receipt when the type is absent", () => {
    // The conservative reading: an unknown type still needs a receipt, so
    // existing call sites that never passed a type keep their behaviour.
    const flags = evaluateExpense(expense(undefined), ctx());
    expect(flags.map((f) => f.rule)).toContain("receipt_required");
  });

  it("does NOT flag a per-diem for a missing receipt", () => {
    const flags = evaluateExpense(expense("per_diem"), ctx());
    expect(flags.map((f) => f.rule)).not.toContain("receipt_required");
  });

  it("does NOT flag mileage either", () => {
    // Previously exempt only by accident — nothing set a threshold on the
    // categories mileage happened to use. Now it is a decision.
    const flags = evaluateExpense(expense("mileage"), ctx());
    expect(flags.map((f) => f.rule)).not.toContain("receipt_required");
  });

  it("requiresReceipt states the rule directly", () => {
    expect(requiresReceipt("regular")).toBe(true);
    expect(requiresReceipt(undefined)).toBe(true);
    expect(requiresReceipt("per_diem")).toBe(false);
    expect(requiresReceipt("mileage")).toBe(false);
  });

  it("STILL applies the per-expense limit to a per-diem", () => {
    // The exemption removes one rule, not the policy engine.
    const flags = evaluateExpense(
      expense("per_diem"),
      ctx({ category: { ...LIMITS, perExpenseLimit: 200_000 } })
    );
    expect(flags.map((f) => f.rule)).toContain("per_expense_limit");
  });

  it("STILL applies the monthly limit to a per-diem", () => {
    const flags = evaluateExpense(
      expense("per_diem"),
      ctx({ category: { ...LIMITS, monthlyLimit: 600_000 }, monthlySpent: 200_000 })
    );
    expect(flags.map((f) => f.rule)).toContain("monthly_limit");
  });

  it("STILL detects a duplicated per-diem claim", () => {
    // This matters MORE for per-diem than for a receipted expense: there is
    // no receipt to notice you have already seen.
    const flags = evaluateExpense(
      expense("per_diem"),
      ctx({
        duplicateCandidates: [
          {
            amount: 500_000,
            date: new Date("2026-08-18T00:00:00.000Z"),
            merchant: "Per diem — Metro",
          },
        ],
      })
    );
    expect(flags.map((f) => f.rule)).toContain("duplicate");
  });

  it("STILL applies the age rule to a per-diem", () => {
    const flags = evaluateExpense(expense("per_diem"), ctx({ maxAgeDays: 1 }));
    expect(flags.map((f) => f.rule)).toContain("expense_age");
  });
});

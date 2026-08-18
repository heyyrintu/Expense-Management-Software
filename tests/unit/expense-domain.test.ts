import { describe, expect, it } from "vitest";
import {
  isExpenseDeletable,
  isExpenseEditable,
  toExpenseData,
  type ExpenseStatus,
} from "@/lib/domain/expense";

const NON_DRAFT: ExpenseStatus[] = ["submitted", "approved", "rejected", "reimbursed"];

describe("draft-only editing", () => {
  it("draft is editable and deletable", () => {
    expect(isExpenseEditable("draft")).toBe(true);
    expect(isExpenseDeletable("draft")).toBe(true);
  });
  it("every non-draft status is locked", () => {
    for (const s of NON_DRAFT) {
      expect(isExpenseEditable(s), s).toBe(false);
      expect(isExpenseDeletable(s), s).toBe(false);
    }
  });
});

describe("toExpenseData", () => {
  const base = {
    amount: "123.45",
    date: "2026-08-10",
    merchant: "Uber",
    categoryId: "0198c5f2-0000-7000-8000-000000000c01",
    projectId: "",
    purpose: "client visit",
  };

  it("converts amount to minor units and date to UTC midnight", () => {
    const d = toExpenseData(base);
    expect(d?.amount).toBe(12345);
    expect(d?.date.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(d?.projectId).toBeNull();
  });

  it("keeps a real project id", () => {
    const d = toExpenseData({ ...base, projectId: "0198c5f2-0000-7000-8000-000000000p01" });
    expect(d?.projectId).toBe("0198c5f2-0000-7000-8000-000000000p01");
  });

  it("rejects zero and unparseable amounts", () => {
    expect(toExpenseData({ ...base, amount: "0" })).toBeNull();
    expect(toExpenseData({ ...base, amount: "0.00" })).toBeNull();
    expect(toExpenseData({ ...base, amount: "1.999" })).toBeNull();
  });
});

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
    currency: "INR",
    fxRate: "1",
    billable: false,
    clientId: "",
    taxAmount: "",
    taxNumber: "",
    splits: [],
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

describe("toExpenseData — billable + tax (6.3)", () => {
  const base = {
    amount: "100.00",
    date: "2026-08-10",
    merchant: "Uber",
    categoryId: "0198c5f2-0000-7000-8000-000000000c01",
    projectId: "",
    purpose: "",
    currency: "INR",
    fxRate: "1",
    billable: true,
    clientId: "0198c5f2-0000-7000-8000-00000000cl01",
    taxAmount: "18.00",
    taxNumber: "29AAACC1234F1Z5",
    splits: [],
  };

  it("carries billable/client/tax through", () => {
    const d = toExpenseData(base);
    expect(d?.billable).toBe(true);
    expect(d?.clientId).toBe(base.clientId);
    expect(d?.taxAmount).toBe(1800);
    expect(d?.taxNumber).toBe("29AAACC1234F1Z5");
  });

  it("non-billable drops the client; empty tax → null", () => {
    const d = toExpenseData({ ...base, billable: false, taxAmount: "", taxNumber: "" });
    expect(d?.clientId).toBeNull();
    expect(d?.taxAmount).toBeNull();
    expect(d?.taxNumber).toBeNull();
  });

  it("tax above the bill amount is invalid", () => {
    expect(toExpenseData({ ...base, taxAmount: "100.01" })).toBeNull();
  });
});

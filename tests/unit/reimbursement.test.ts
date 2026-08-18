import { describe, expect, it } from "vitest";
import {
  maskAccountNumber,
  outstandingBalance,
  planPayment,
} from "@/lib/domain/reimbursement";
import { nextStatus, REPORT_ACTIONS } from "@/lib/domain/report-workflow";

describe("outstandingBalance", () => {
  it("total minus payments, floored at zero", () => {
    expect(outstandingBalance(10000, [])).toBe(10000);
    expect(outstandingBalance(10000, [{ amountPaid: 4000 }, { amountPaid: 1000 }])).toBe(5000);
    expect(outstandingBalance(10000, [{ amountPaid: 10000 }])).toBe(0);
    expect(outstandingBalance(10000, [{ amountPaid: 12000 }])).toBe(0);
  });
  it("rejects float money", () => {
    expect(() => outstandingBalance(100.5, [])).toThrow();
  });
});

describe("planPayment", () => {
  it("full balance → reimburse; less → reimburse_partial", () => {
    expect(planPayment(10000, 10000)).toEqual({ action: "reimburse" });
    expect(planPayment(10000, 4000)).toEqual({ action: "reimburse_partial" });
  });
  it("rejects zero, negative, overpay, and already-paid", () => {
    expect("error" in planPayment(10000, 0)).toBe(true);
    expect("error" in planPayment(10000, -5)).toBe(true);
    expect("error" in planPayment(10000, 10001)).toBe(true);
    expect("error" in planPayment(0, 100)).toBe(true);
  });
});

describe("partial-reimbursement transitions", () => {
  it("approved and partially_reimbursed accept both payment actions", () => {
    expect(nextStatus("approved", "reimburse_partial")).toBe("partially_reimbursed");
    expect(nextStatus("approved", "reimburse")).toBe("reimbursed");
    expect(nextStatus("partially_reimbursed", "reimburse_partial")).toBe("partially_reimbursed");
    expect(nextStatus("partially_reimbursed", "reimburse")).toBe("reimbursed");
  });
  it("partially_reimbursed accepts nothing else; reimbursed stays terminal", () => {
    for (const a of REPORT_ACTIONS) {
      if (a === "reimburse" || a === "reimburse_partial") continue;
      expect(nextStatus("partially_reimbursed", a), a).toBeNull();
    }
    for (const a of REPORT_ACTIONS) {
      expect(nextStatus("reimbursed", a), a).toBeNull();
    }
  });
});

describe("maskAccountNumber", () => {
  it("keeps only the last 4 digits", () => {
    expect(maskAccountNumber("12345678901234")).toBe("****1234");
    expect(maskAccountNumber("1234-5678-9012")).toBe("****9012");
  });
  it("very short numbers are fully masked", () => {
    expect(maskAccountNumber("123")).toBe("****");
    expect(maskAccountNumber("")).toBe("****");
  });
});

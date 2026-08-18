import { describe, expect, it } from "vitest";
import {
  autoReconcile,
  parseStatementAmount,
  parseStatementDate,
  parseStatementRows,
  reconciliationSummary,
  suggestMapping,
  type PaymentCandidate,
  type StatementLine,
} from "@/lib/domain/reconcile";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const line = (date: string, amount: number, reference = ""): StatementLine => ({
  date: d(date), amount, reference,
});
const pay = (id: string, amount: number, date: string, reference = ""): PaymentCandidate => ({
  id, amountPaid: amount, paidAt: d(date), reference,
});

describe("date parsing — dd/mm priority", () => {
  it("03/04/2026 is 3 April (day-first), not 4 March", () => {
    expect(parseStatementDate("03/04/2026")?.toISOString()).toBe("2026-04-03T00:00:00.000Z");
  });
  it("other formats", () => {
    expect(parseStatementDate("2026-08-05")?.toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(parseStatementDate("05-Aug-2026")?.toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(parseStatementDate("31/02/2026")).toBeNull();
    expect(parseStatementDate("notadate")).toBeNull();
  });
});

describe("amount parsing", () => {
  it("currency symbols, commas, Dr suffix", () => {
    expect(parseStatementAmount("₹1,234.56")).toBe(123456);
    expect(parseStatementAmount("1234.56 Dr")).toBe(123456);
    expect(parseStatementAmount("-500.00")).toBe(-50000);
    expect(parseStatementAmount("x")).toBeNull();
  });
});

describe("mapping", () => {
  it("suggests columns from header names", () => {
    expect(
      suggestMapping(["Txn Date", "Narration", "UTR No", "Withdrawal Amt", "Balance"])
    ).toEqual({ dateCol: 0, amountCol: 3, referenceCol: 2 });
  });
  it("parseStatementRows applies mapping, skips credits/bad rows", () => {
    const { lines, skipped } = parseStatementRows(
      [
        ["05/08/2026", "NEFT UTR12345678", "1000.00"],
        ["06/08/2026", "SALARY CREDIT", "-5000.00"],
        ["bad", "x", "10.00"],
      ],
      { dateCol: 0, referenceCol: 1, amountCol: 2 }
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(100000);
    expect(skipped.map((s) => s.reason)).toEqual(["credit or zero", "unreadable date"]);
  });
});

describe("pass 1 — reference matching", () => {
  it("exact normalized equality and narration containment (≥8 chars)", () => {
    const m = autoReconcile(
      [line("2026-08-05", 100, "NEFT/UTRABC12345/PAYOUT"), line("2026-08-06", 200, "utr xyz 999")],
      [pay("p1", 100, "2026-08-01", "UTRABC12345"), pay("p2", 200, "2026-08-06", "UTRXYZ999")]
    );
    expect(m.get(0)).toEqual({ paymentId: "p1", pass: 1 });
    expect(m.get(1)).toEqual({ paymentId: "p2", pass: 1 }); // exact after normalization
  });
  it("ambiguous references are skipped", () => {
    const m = autoReconcile(
      [line("2026-08-05", 100, "UTRSAME1234")],
      [pay("p1", 100, "2026-08-01", "UTRSAME1234"), pay("p2", 999, "2026-08-02", "UTRSAME1234")]
    );
    expect(m.size).toBe(0);
  });
  it("short references never containment-match", () => {
    const m = autoReconcile(
      [line("2026-08-05", 100, "PAYMENT 123 CONFIRMED")],
      [pay("p1", 500, "2026-01-01", "123")]
    );
    expect(m.size).toBe(0);
  });
});

describe("pass 2 — amount + date ±3, unambiguous only", () => {
  it("matches inside the window, rejects outside", () => {
    expect(
      autoReconcile([line("2026-08-05", 100)], [pay("p1", 100, "2026-08-08")]).get(0)
    ).toEqual({ paymentId: "p1", pass: 2 });
    expect(
      autoReconcile([line("2026-08-05", 100)], [pay("p1", 100, "2026-08-09")]).size
    ).toBe(0);
  });
  it("two candidate payments for one line → ambiguous, no match", () => {
    const m = autoReconcile(
      [line("2026-08-05", 100)],
      [pay("p1", 100, "2026-08-04"), pay("p2", 100, "2026-08-06")]
    );
    expect(m.size).toBe(0);
  });
  it("one payment fitting two lines → ambiguous, no match (reverse check)", () => {
    const m = autoReconcile(
      [line("2026-08-04", 100), line("2026-08-06", 100)],
      [pay("p1", 100, "2026-08-05")]
    );
    expect(m.size).toBe(0);
  });
  it("never double-matches: pass-1 winner is excluded from pass 2", () => {
    const m = autoReconcile(
      [line("2026-08-05", 100, "UTRAA111111"), line("2026-08-05", 100)],
      [pay("p1", 100, "2026-08-05", "UTRAA111111"), pay("p2", 100, "2026-08-05")]
    );
    expect(m.get(0)).toEqual({ paymentId: "p1", pass: 1 });
    expect(m.get(1)).toEqual({ paymentId: "p2", pass: 2 });
    const ids = [...m.values()].map((v) => v.paymentId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("summary", () => {
  it("matched % floors; unexplained sums unmatched lines", () => {
    expect(reconciliationSummary(3, 2, [5000])).toEqual({ matchedPct: 66, unexplained: 5000 });
    expect(reconciliationSummary(0, 0, [])).toEqual({ matchedPct: 100, unexplained: 0 });
  });
});

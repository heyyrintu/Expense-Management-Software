// Payment-run summary (D3.2). This is the arithmetic behind a screen that
// moves money, so it gets tested rather than trusted.
import { describe, expect, it } from "vitest";

import { resolveBatchLine, summariseBatch, type BatchLineInput } from "@/lib/domain/payment-batch";
import { outstandingBalance, planPayment } from "@/lib/domain/reimbursement";

function line(over: Partial<BatchLineInput> = {}): BatchLineInput {
  return {
    reportId: "r1",
    title: "August travel",
    ownerName: "Arjun",
    balance: 100000,
    reference: "UTR123",
    hasBankDetails: true,
    ...over,
  };
}

describe("resolveBatchLine", () => {
  it("pays the full balance when the amount is blank", () => {
    // The common case, and it shouldn't require retyping a number already
    // on screen.
    const resolved = resolveBatchLine(line());
    expect(resolved.amount).toBe(100000);
    expect(resolved.partial).toBe(false);
    expect(resolved.remaining).toBe(0);
    expect(resolved.problem).toBeNull();
  });

  it("treats a smaller amount as a partial payment and tracks what is left", () => {
    const resolved = resolveBatchLine(line({ amountText: "400.00" }));
    expect(resolved.amount).toBe(40000);
    expect(resolved.partial).toBe(true);
    expect(resolved.remaining).toBe(60000);
  });

  it("refuses a reference-less line", () => {
    expect(resolveBatchLine(line({ reference: "  " })).problem).toBe(
      "Needs a reference or UTR."
    );
  });

  it("refuses an overpayment rather than letting the server catch it", () => {
    // Overpaying is almost always a typo, and finding out after the batch
    // committed is the wrong moment.
    const resolved = resolveBatchLine(line({ amountText: "2000.00" }));
    expect(resolved.problem).toBe("More than the outstanding balance.");
    expect(resolved.amount).toBe(0);
  });

  it("refuses zero and nonsense", () => {
    expect(resolveBatchLine(line({ amountText: "0" })).problem).toBe(
      "A payment of zero isn't a payment."
    );
    expect(resolveBatchLine(line({ amountText: "abc" })).problem).toBe(
      "That amount isn't a valid figure."
    );
  });

  it("never reports a paid amount for a line it refused", () => {
    // A problem line contributing to the batch total would overstate what is
    // about to be paid — the one number the reader is authorising.
    for (const amountText of ["0", "abc", "99999.00"]) {
      expect(resolveBatchLine(line({ amountText })).amount, amountText).toBe(0);
    }
  });
});

describe("summariseBatch", () => {
  const two = [
    line({ reportId: "a", balance: 100000 }),
    line({ reportId: "b", balance: 50000, amountText: "200.00" }),
  ];

  it("totals only what will actually be paid", () => {
    const summary = summariseBatch(two);
    expect(summary.total).toBe(100000 + 20000);
    expect(summary.count).toBe(2);
    expect(summary.partialCount).toBe(1);
    expect(summary.ready).toBe(true);
  });

  it("is NOT ready while any single line has a problem", () => {
    // A batch is one action to the reader. Letting it go half-valid means
    // discovering the other half failed after the money moved.
    const summary = summariseBatch([...two, line({ reportId: "c", reference: "" })]);
    expect(summary.ready).toBe(false);
    expect(summary.problems).toHaveLength(1);
  });

  it("is not ready when empty", () => {
    expect(summariseBatch([]).ready).toBe(false);
  });

  it("treats missing bank details as a warning, not a blocker", () => {
    // Cash and payroll runs are legitimate, and finance may be recording a
    // payment already made another way.
    const summary = summariseBatch([line({ hasBankDetails: false })]);
    expect(summary.missingBankDetails).toHaveLength(1);
    expect(summary.ready).toBe(true);
  });
});

describe("the preview agrees with the server's own verdict", () => {
  const balance = 100000;

  it("accepts exactly what planPayment accepts, and refuses what it refuses", () => {
    // summariseBatch only PREVIEWS; lib/domain/reimbursement decides. If the
    // two ever disagree, the review screen is lying about what will happen —
    // either promising a payment the server will refuse, or blocking one it
    // would have taken.
    const cases: Array<{ amountText?: string; minor: number }> = [
      { amountText: undefined, minor: balance }, // blank = full balance
      { amountText: "400.00", minor: 40000 },
      { amountText: "1000.00", minor: 100000 },
      { amountText: "0", minor: 0 },
      { amountText: "2000.00", minor: 200000 },
    ];

    for (const { amountText, minor } of cases) {
      const preview = resolveBatchLine(line({ balance, amountText }));
      const server = planPayment(balance, minor);
      const serverRefused = "error" in server;
      const previewRefused = preview.problem !== null;
      expect(previewRefused, `${amountText ?? "(blank)"}`).toBe(serverRefused);

      if (!serverRefused) {
        // And they agree on whether it settles the report or only part of it.
        expect(preview.partial, `${amountText ?? "(blank)"}`).toBe(
          server.action === "reimburse_partial"
        );
      }
    }
  });

  it("agrees with outstandingBalance about what is left afterwards", () => {
    const preview = resolveBatchLine(line({ balance, amountText: "400.00" }));
    expect(outstandingBalance(balance, [{ amountPaid: preview.amount }])).toBe(
      preview.remaining
    );
  });

  it("leaves nothing owing when the full balance is paid", () => {
    const preview = resolveBatchLine(line({ balance }));
    expect(outstandingBalance(balance, [{ amountPaid: preview.amount }])).toBe(0);
    expect(preview.remaining).toBe(0);
  });
});

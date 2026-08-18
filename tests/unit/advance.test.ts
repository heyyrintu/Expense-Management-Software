import { describe, expect, it } from "vitest";
import {
  ADVANCE_ACTIONS,
  ADVANCE_STATUSES,
  allocateSettlement,
  canDecideAdvance,
  nextAdvanceStatus,
  outstandingAdvance,
  type AdvanceAction,
  type AdvanceStatus,
} from "@/lib/domain/advance";

const LEGAL: Array<[AdvanceStatus, AdvanceAction, AdvanceStatus]> = [
  ["draft", "submit", "submitted"],
  ["submitted", "approve", "approved"],
  ["submitted", "reject", "rejected"],
  ["approved", "disburse", "disbursed"],
  ["disbursed", "settle_partial", "partially_settled"],
  ["disbursed", "settle_full", "settled"],
  ["partially_settled", "settle_partial", "partially_settled"],
  ["partially_settled", "settle_full", "settled"],
];

describe("advance state machine — exhaustive matrix", () => {
  it("allows exactly the documented transitions", () => {
    for (const from of ADVANCE_STATUSES) {
      for (const action of ADVANCE_ACTIONS) {
        const expected = LEGAL.find(([f, a]) => f === from && a === action)?.[2] ?? null;
        expect(nextAdvanceStatus(from, action), `${from} --${action}-->`).toBe(expected);
      }
    }
  });
});

describe("canDecideAdvance", () => {
  it("assigned approver only, never the owner", () => {
    expect(canDecideAdvance({ actorId: "ap", ownerId: "o", ownerApproverId: "ap" })).toBe(true);
    expect(canDecideAdvance({ actorId: "x", ownerId: "o", ownerApproverId: "ap" })).toBe(false);
    expect(canDecideAdvance({ actorId: "o", ownerId: "o", ownerApproverId: "o" })).toBe(false);
    expect(canDecideAdvance({ actorId: "ap", ownerId: "o", ownerApproverId: null })).toBe(false);
  });
});

describe("settlement math", () => {
  it("outstanding floors at zero", () => {
    expect(outstandingAdvance(10000, 0)).toBe(10000);
    expect(outstandingAdvance(10000, 4000)).toBe(6000);
    expect(outstandingAdvance(10000, 12000)).toBe(0);
  });

  it("allocates oldest-first across multiple advances with remainder", () => {
    const { allocations, remainder } = allocateSettlement(15000, [
      { id: "old", amount: 10000, settledAmount: 4000 }, // outstanding 6000
      { id: "new", amount: 5000, settledAmount: 0 }, // outstanding 5000
    ]);
    expect(allocations).toEqual([
      { advanceId: "old", amount: 6000, newSettledAmount: 10000, newStatus: "settled" },
      { advanceId: "new", amount: 5000, newSettledAmount: 5000, newStatus: "settled" },
    ]);
    expect(remainder).toBe(4000); // paid to the employee in cash
  });

  it("partial coverage leaves the advance partially settled and zero remainder", () => {
    const { allocations, remainder } = allocateSettlement(3000, [
      { id: "a", amount: 10000, settledAmount: 0 },
    ]);
    expect(allocations).toEqual([
      { advanceId: "a", amount: 3000, newSettledAmount: 3000, newStatus: "partially_settled" },
    ]);
    expect(remainder).toBe(0);
  });

  it("skips already-settled advances; empty list passes everything through", () => {
    const r1 = allocateSettlement(5000, [{ id: "done", amount: 1000, settledAmount: 1000 }]);
    expect(r1.allocations).toHaveLength(0);
    expect(r1.remainder).toBe(5000);
    const r2 = allocateSettlement(5000, []);
    expect(r2.remainder).toBe(5000);
  });

  it("refund-due case: outstanding remains when claims are smaller than the advance", () => {
    const { allocations } = allocateSettlement(2000, [
      { id: "big", amount: 10000, settledAmount: 0 },
    ]);
    const after = allocations[0];
    expect(outstandingAdvance(10000, after.newSettledAmount)).toBe(8000); // refund due to org
  });
});

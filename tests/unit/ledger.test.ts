import { describe, expect, it } from "vitest";
import {
  buildLedger,
  proportionalAllocate,
  sortEvents,
  type LedgerEvent,
} from "@/lib/domain/ledger";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const approved = (id: string, date: string, amount: number): LedgerEvent => ({
  kind: "report_approved", id, date: d(date), title: `Report ${id}`, amount,
});
const payment = (id: string, date: string, amount: number): LedgerEvent => ({
  kind: "payment", id, date: d(date), title: `Report pay`, amount,
  reference: "UTR1", method: "bank_transfer", batchId: null,
});
const advOut = (id: string, date: string, amount: number): LedgerEvent => ({
  kind: "advance_disbursed", id, date: d(date), title: "Trip advance", amount, reference: "ADV-1",
});
const advSettle = (id: string, date: string, amount: number): LedgerEvent => ({
  kind: "advance_settled", id, date: d(date), title: "Settled vs report", amount,
});

describe("running balance", () => {
  it("credits add, debits subtract, running balance per line", () => {
    const { lines, totals } = buildLedger(
      [approved("r1", "2026-08-01", 10000), payment("p1", "2026-08-05", 10000)],
      10000
    );
    expect(lines.map((l) => l.balance)).toEqual([10000, 0]);
    expect(totals).toMatchObject({ approved: 10000, paid: 10000, outstanding: 0, netBalance: 0 });
  });

  it("partial payments leave the exact outstanding", () => {
    const { lines, totals } = buildLedger(
      [approved("r1", "2026-08-01", 10000), payment("p1", "2026-08-05", 4000), payment("p2", "2026-08-20", 3500)],
      10000
    );
    expect(lines.map((l) => l.balance)).toEqual([10000, 6000, 2500]);
    expect(totals.outstanding).toBe(2500);
    expect(totals.outstanding).toBe(totals.approved - totals.paid); // invariant
  });

  it("advance offsets: disbursed debits, settlement credits back", () => {
    const { lines, totals } = buildLedger(
      [
        advOut("a1", "2026-08-01", 20000),
        approved("r1", "2026-08-10", 12000),
        payment("p1", "2026-08-12", 12000), // paid AND offset against advance
        advSettle("s1", "2026-08-12", 12000),
      ],
      12000
    );
    expect(lines.map((l) => l.balance)).toEqual([-20000, -8000, -20000, -8000]);
    expect(totals.netBalance).toBe(-8000); // refund/spend still due to org
    expect(totals.outstanding).toBe(0); // report side fully settled — invariant holds
  });
});

describe("deterministic ordering", () => {
  it("date asc, id asc tiebreak — input order irrelevant", () => {
    const events = [
      payment("b", "2026-08-05", 100),
      approved("a", "2026-08-05", 100),
      approved("z", "2026-08-01", 100),
    ];
    const once = buildLedger(events, 0).lines.map((l) => l.id);
    const again = buildLedger([...events].reverse(), 0).lines.map((l) => l.id);
    expect(once).toEqual(["z", "a", "b"]);
    expect(again).toEqual(once);
    expect(sortEvents(events)[0].id).toBe("z");
  });
});

describe("proportionalAllocate", () => {
  it("exact integer split, last absorbs remainder", () => {
    const out = proportionalAllocate(10001, [
      { key: "p1", weight: 1 },
      { key: "p2", weight: 1 },
      { key: "p3", weight: 1 },
    ]);
    expect([...out.values()].reduce((a, b) => a + b, 0)).toBe(10001);
    expect(out.get("p1")).toBe(3333);
    expect(out.get("p3")).toBe(3335);
  });
  it("zero weights / empty → empty map", () => {
    expect(proportionalAllocate(100, []).size).toBe(0);
    expect(proportionalAllocate(100, [{ key: "x", weight: 0 }]).size).toBe(0);
  });
});

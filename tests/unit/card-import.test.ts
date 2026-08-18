import { describe, expect, it } from "vitest";
import {
  autoMatch,
  dayDiff,
  parseCardCsv,
  splitCsvLine,
  type MatchCandidate,
} from "@/lib/domain/card-import";

describe("splitCsvLine", () => {
  it("handles quotes, embedded commas, doubled quotes", () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
    expect(splitCsvLine('x,"say ""hi""",y')).toEqual(["x", 'say "hi"', "y"]);
  });
});

describe("parseCardCsv", () => {
  const CSV = [
    "Txn Date,Description,Amount (INR)",
    "2026-08-10,UBER TRIP BLR,432.50",
    '12/08/2026,"AMAZON, IN",1299.00',
    "2026-08-11,PAYMENT RECEIVED,-5000.00",
    "2026-08-11,,100.00",
    "notadate,SOMETHING,50.00",
  ].join("\n");

  it("parses flexible headers, dd/mm dates, quoted merchants; skips credits and bad rows", () => {
    const res = parseCardCsv(CSV);
    if ("error" in res) throw new Error(res.error);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({ amount: 43250, merchant: "UBER TRIP BLR" });
    expect(res.rows[1].date.toISOString()).toBe("2026-08-12T00:00:00.000Z");
    expect(res.rows[1].merchant).toBe("AMAZON, IN");
    expect(res.skipped.map((s) => s.reason)).toEqual([
      "credit or zero amount",
      "missing merchant",
      "unreadable date",
    ]);
  });

  it("errors on missing columns or no data", () => {
    expect("error" in parseCardCsv("just,one,line")).toBe(true);
    expect("error" in parseCardCsv("a,b,c\n1,2,3")).toBe(true);
  });

  it("strips currency symbols and thousands separators", () => {
    const res = parseCardCsv("date,amount,description\n2026-08-01,\"₹1,234.56\",Cafe");
    if ("error" in res) throw new Error(res.error);
    expect(res.rows[0].amount).toBe(123456);
  });
});

describe("autoMatch", () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  const cand = (id: string, amount: number, date: string, merchant = "x"): MatchCandidate => ({
    id, amount, date: d(date), merchant,
  });

  it("matches exact amount within ±2 days, preferring the closer date", () => {
    const m = autoMatch(
      [{ index: 0, amount: 1000, date: d("2026-08-10"), merchant: "Uber" }],
      [cand("far", 1000, "2026-08-12"), cand("near", 1000, "2026-08-10")]
    );
    expect(m.get(0)).toBe("near");
  });

  it("rejects outside the window or different amounts", () => {
    const m = autoMatch(
      [{ index: 0, amount: 1000, date: d("2026-08-10"), merchant: "Uber" }],
      [cand("late", 1000, "2026-08-13"), cand("wrong", 1001, "2026-08-10")]
    );
    expect(m.size).toBe(0);
  });

  it("merchant similarity breaks date ties", () => {
    const m = autoMatch(
      [{ index: 0, amount: 1000, date: d("2026-08-10"), merchant: "UBER TRIP" }],
      [cand("other", 1000, "2026-08-10", "Ola"), cand("uber", 1000, "2026-08-10", "Uber")]
    );
    expect(m.get(0)).toBe("uber");
  });

  it("never double-assigns an expense", () => {
    const m = autoMatch(
      [
        { index: 0, amount: 1000, date: d("2026-08-10"), merchant: "A" },
        { index: 1, amount: 1000, date: d("2026-08-10"), merchant: "B" },
      ],
      [cand("only", 1000, "2026-08-10")]
    );
    expect(m.get(0)).toBe("only");
    expect(m.has(1)).toBe(false);
  });

  it("dayDiff is symmetric whole days", () => {
    expect(dayDiff(d("2026-08-10"), d("2026-08-12"))).toBe(2);
    expect(dayDiff(d("2026-08-12"), d("2026-08-10"))).toBe(2);
  });
});

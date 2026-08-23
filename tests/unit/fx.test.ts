import { describe, expect, it } from "vitest";
import { convertToBase, isValidFxRate } from "@/lib/money";
import { getFxRate, STUB_BASE_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/fx";

describe("convertToBase — banker's rounding", () => {
  it("plain conversions", () => {
    expect(convertToBase(12000, "83.50")).toBe(1002000); // $120 → ₹10,020
    expect(convertToBase(100, "1")).toBe(100);
    expect(convertToBase(0, "83.5")).toBe(0);
  });

  it("round-half-to-even on exact halves", () => {
    // 25 × 0.5 = 12.5 → even neighbour 12; 35 × 0.5 = 17.5 → 18
    expect(convertToBase(25, "0.5")).toBe(12);
    expect(convertToBase(35, "0.5")).toBe(18);
    // 15 × 0.1 = 1.5 → 2 (even); 25 × 0.1 = 2.5 → 2 (even)
    expect(convertToBase(15, "0.1")).toBe(2);
    expect(convertToBase(25, "0.1")).toBe(2);
  });

  it("non-half remainders round nearest", () => {
    expect(convertToBase(999, "0.333333")).toBe(333); // 332.999667 → 333
    expect(convertToBase(101, "0.01")).toBe(1); // 1.01 → 1
  });

  it("six-decimal rates stay exact (integer math)", () => {
    expect(convertToBase(1000000, "0.012345")).toBe(12345);
  });

  it("rejects garbage, zero, and negatives", () => {
    for (const bad of ["0", "0.0", "-1", "1e3", "abc", "", "1.1234567"]) {
      expect(convertToBase(100, bad), bad).toBeNull();
      expect(isValidFxRate(bad), bad).toBe(false);
    }
    expect(() => convertToBase(10.5, "1")).toThrow(); // float money is a bug
  });
});

// ---------------------------------------------------------------------------
// FX stub reachability (G6)
//
// The bug this locks down: the stub used to be a from→to table read directly,
// so only the pairs literally written in it resolved. `getFxRate("INR","USD")`
// returned null, and a non-INR tenant — every one of whose expenses needs a
// rate INTO their base — got no prefill at all, on every expense, forever.
//
// The assertions are about REACHABILITY and CONSISTENCY, not about the numbers
// being right. They are a stub; they will be wrong tomorrow.
// ---------------------------------------------------------------------------

describe("fx stub provider — identity", () => {
  it("is exactly 1 for a currency against itself", async () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(await getFxRate(c, c)).toBe("1");
    }
  });

  it("supported list has no zero-decimal currencies (money lib assumes 2dp)", () => {
    expect(SUPPORTED_CURRENCIES).not.toContain("JPY");
  });
});

describe("fx stub provider — direct quotes", () => {
  it("returns the base quote for X → INR", async () => {
    // Note the trimmed form: "83.5", not "83.50". Trailing zeros are dropped
    // so an inverted rate and a direct one are formatted by one rule.
    expect(await getFxRate("USD", "INR")).toBe("83.5");
    expect(await getFxRate("EUR", "INR")).toBe("90.25");
  });
});

describe("fx stub provider — INVERSION", () => {
  it("resolves INR → X, which used to return null", async () => {
    // The whole G6 bug in one assertion.
    const rate = await getFxRate("INR", "USD");
    expect(rate).not.toBeNull();
    expect(Number(rate)).toBeCloseTo(1 / 83.5, 6);
  });

  it("inverts to the reciprocal, not to a rounded-off approximation", async () => {
    // 1/83.5 = 0.011976... Two decimals would give 0.01 and price a $1,000
    // expense at ₹100,000 instead of ₹83,500.
    expect(await getFxRate("INR", "USD")).toBe("0.011976");
  });

  it("round-trips: X → INR → X returns to 1 within rounding", async () => {
    for (const c of SUPPORTED_CURRENCIES) {
      const out = Number(await getFxRate(c, "INR"));
      const back = Number(await getFxRate("INR", c));
      expect(out * back).toBeCloseTo(1, 4);
    }
  });
});

describe("fx stub provider — CROSS-RATE", () => {
  it("resolves a pair with no direct quote, e.g. USD → EUR", async () => {
    // This returned null before G6.
    const rate = await getFxRate("USD", "EUR");
    expect(rate).not.toBeNull();
    expect(Number(rate)).toBeCloseTo(83.5 / 90.25, 6);
  });

  it("agrees with going through the base by hand", async () => {
    // The property that makes a single-column table safe: the cross-rate is
    // not an independently-written number that can drift.
    const usdInr = Number(await getFxRate("USD", "INR"));
    const eurInr = Number(await getFxRate("EUR", "INR"));
    expect(Number(await getFxRate("USD", "EUR"))).toBeCloseTo(usdInr / eurInr, 6);
  });

  it("is symmetric: X→Y and Y→X are reciprocals", async () => {
    const ab = Number(await getFxRate("GBP", "AED"));
    const ba = Number(await getFxRate("AED", "GBP"));
    expect(ab * ba).toBeCloseTo(1, 4);
  });
});

describe("fx stub provider — every supported pair resolves", () => {
  it("no pair returns null, in either direction", async () => {
    // The regression guard. A single missing pair means one tenant types a
    // rate by hand on every expense they file.
    const missing: string[] = [];
    for (const from of SUPPORTED_CURRENCIES) {
      for (const to of SUPPORTED_CURRENCIES) {
        if ((await getFxRate(from, to)) === null) missing.push(`${from}->${to}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every rate it returns is one lib/money.ts will accept", async () => {
    // A prefill the form then rejects is worse than no prefill — and
    // convertToBase returns null for a rate isValidFxRate refuses.
    for (const from of SUPPORTED_CURRENCIES) {
      for (const to of SUPPORTED_CURRENCIES) {
        const rate = await getFxRate(from, to);
        expect(rate).not.toBeNull();
        expect(isValidFxRate(rate!), `${from}->${to} = ${rate}`).toBe(true);
        expect(convertToBase(10000, rate!), `${from}->${to}`).not.toBeNull();
      }
    }
  });
});

describe("fx stub provider — unknown currencies", () => {
  it("returns null rather than a confident wrong number", async () => {
    // null is the signal that the form asks the user. That path is unchanged.
    expect(await getFxRate("XXX", "INR")).toBeNull();
    expect(await getFxRate("INR", "XXX")).toBeNull();
    expect(await getFxRate("XXX", "YYY")).toBeNull();
  });

  it("still returns 1 for an unknown currency against itself", async () => {
    expect(await getFxRate("XXX", "XXX")).toBe("1");
  });

  it("names INR as the stub's base", async () => {
    expect(STUB_BASE_CURRENCY).toBe("INR");
  });
});

// 6.4: report totals mix currencies via base amounts
import { computeReportTotal } from "@/lib/domain/report-workflow";

describe("mixed-currency report totals", () => {
  it("sums base amounts across currencies", () => {
    const usd = convertToBase(12000, "83.50"); // $120 → ₹10,020.00
    const eur = convertToBase(5000, "90.25"); // €50 → ₹4,512.50
    const inr = 250000; // ₹2,500 (rate 1)
    expect(usd).toBe(1002000);
    expect(eur).toBe(451250);
    expect(computeReportTotal([usd!, eur!, inr])).toBe(1703250); // ₹17,032.50
  });
});

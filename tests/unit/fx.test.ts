import { describe, expect, it } from "vitest";
import { convertToBase, isValidFxRate } from "@/lib/money";
import { getFxRate, SUPPORTED_CURRENCIES } from "@/lib/fx";

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

describe("fx stub provider", () => {
  it("identity is 1; known pairs return fixed rates; unknown → null (manual)", async () => {
    expect(await getFxRate("INR", "INR")).toBe("1");
    expect(await getFxRate("USD", "INR")).toBe("83.50");
    expect(await getFxRate("USD", "EUR")).toBeNull();
  });
  it("supported list has no zero-decimal currencies (money lib assumes 2dp)", () => {
    expect(SUPPORTED_CURRENCIES).not.toContain("JPY");
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

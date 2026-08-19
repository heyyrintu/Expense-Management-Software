import { describe, expect, it } from "vitest";
import {
  assertMinorUnits,
  formatMoney,
  parseToMinorUnits,
  toDecimalString,
} from "@/lib/money";

describe("parseToMinorUnits", () => {
  it("parses whole and decimal amounts", () => {
    expect(parseToMinorUnits("0")).toBe(0);
    expect(parseToMinorUnits("12")).toBe(1200);
    expect(parseToMinorUnits("12.3")).toBe(1230);
    expect(parseToMinorUnits("12.34")).toBe(1234);
    expect(parseToMinorUnits(" 500.00 ")).toBe(50000);
  });

  it("rejects negatives, >2dp, exponents, garbage", () => {
    for (const bad of ["-1", "1.234", "1e5", "abc", "", ".", "1.", "12,34", "Infinity", "NaN"]) {
      expect(parseToMinorUnits(bad), bad).toBeNull();
    }
  });

  it("stays in safe-integer territory for large business amounts", () => {
    expect(parseToMinorUnits("9999999999999.99")).toBe(999999999999999);
  });
});

describe("toDecimalString", () => {
  it("round-trips with parse", () => {
    for (const v of [0, 1, 99, 100, 1234, 50000, 999999999999999]) {
      expect(parseToMinorUnits(toDecimalString(v))).toBe(v);
    }
  });
  it("pads cents", () => {
    expect(toDecimalString(5)).toBe("0.05");
    expect(toDecimalString(1230)).toBe("12.30");
  });
  it("throws on non-integer input (floats are a bug)", () => {
    expect(() => toDecimalString(12.5)).toThrow();
    expect(() => assertMinorUnits(0.1 + 0.2)).toThrow();
  });
});

describe("formatMoney", () => {
  it("formats INR", () => {
    expect(formatMoney(123456, "INR")).toContain("1,234.56");
  });
  it("falls back gracefully for unknown codes", () => {
    expect(formatMoney(1234, "XXX")).toContain("12.34");
  });

  // ---- D1.1: the guarantees <Amount> relies on ----

  it("signs negatives with a minus, NEVER parentheses (§6.2)", () => {
    // The "accounting" currency sign would render (₹450.00). Parentheses are
    // invisible at a glance and vanish entirely when read aloud.
    const out = formatMoney(-45000, "INR");
    expect(out).toContain("-");
    expect(out).not.toContain("(");
    expect(out).not.toContain(")");
  });

  it("keeps two decimal places at every magnitude", () => {
    expect(formatMoney(0, "INR")).toContain("0.00");
    expect(formatMoney(100, "INR")).toContain("1.00");
    expect(formatMoney(5, "INR")).toContain("0.05");
  });

  it("groups very large values in the Indian system", () => {
    // ₹1,23,45,678.90 — lakhs and crores, not 12,345,678.90.
    expect(formatMoney(1234567890, "INR")).toContain("1,23,45,678.90");
  });

  it("renders foreign currencies with their own symbol", () => {
    expect(formatMoney(123456, "USD")).toContain("1,234.56");
    expect(formatMoney(123456, "EUR")).toContain("1,234.56");
  });

  it("refuses non-integer minor units rather than rendering a wrong amount", () => {
    // Passing 45.5 where 4550 was meant is the bug this catches.
    expect(() => formatMoney(45.5, "INR")).toThrow();
  });
});

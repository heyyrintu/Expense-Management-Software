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
});

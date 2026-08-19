// AmountInput parsing (D2.1). The capture field is the one place a user's
// keystrokes become money, so this is where "never silently rounds" has to be
// true rather than intended.
import { describe, expect, it } from "vitest";

import {
  formatAmountForDisplay,
  normalizeAmountInput,
  parseToMinorUnits,
} from "@/lib/money";
import { moneyString } from "@/lib/schemas/category";

describe("normalizeAmountInput — what people actually type", () => {
  it("takes a plain number", () => {
    expect(normalizeAmountInput("500")).toMatchObject({ text: "500", minor: 50000 });
    expect(normalizeAmountInput("1234.56")).toMatchObject({ text: "1234.56", minor: 123456 });
  });

  it("strips grouping separators from a pasted amount", () => {
    expect(normalizeAmountInput("1,234.56")).toMatchObject({ text: "1234.56", minor: 123456 });
    // en-IN grouping, which is what this app formats in.
    expect(normalizeAmountInput("1,23,456.78")).toMatchObject({
      text: "123456.78",
      minor: 12345678,
    });
  });

  it("strips currency symbols and codes people paste along", () => {
    for (const raw of ["₹1234", "Rs 1234", "Rs.1234", "INR 1234", "$1234", "€1234", "£1234"]) {
      expect(normalizeAmountInput(raw).minor, raw).toBe(123400);
    }
  });

  it("pads a single decimal place rather than reading it as paise", () => {
    // "1234.5" is one rupee fifty paise short of ambiguity: it means .50.
    expect(normalizeAmountInput("1234.5")).toMatchObject({ text: "1234.5", minor: 123450 });
  });

  it("accepts a leading decimal point", () => {
    expect(normalizeAmountInput(".5")).toMatchObject({ minor: 50 });
  });

  it("handles surrounding and non-breaking spaces", () => {
    expect(normalizeAmountInput("  1 234.56 ").minor).toBe(123456);
    expect(normalizeAmountInput(" 1,234.56 ").minor).toBe(123456);
  });

  it("treats empty as empty, not as zero", () => {
    // Zero is a real amount; blank is not. Conflating them puts ₹0.00 in a
    // field the user never filled.
    expect(normalizeAmountInput("")).toEqual({
      text: "",
      minor: null,
      tooPrecise: false,
      invalid: false,
    });
    expect(normalizeAmountInput("   ").minor).toBeNull();
  });

  it("reads a real zero as zero", () => {
    expect(normalizeAmountInput("0")).toMatchObject({ text: "0", minor: 0 });
    expect(normalizeAmountInput("0.00")).toMatchObject({ minor: 0 });
  });
});

describe("normalizeAmountInput — NEVER silently rounds", () => {
  it("refuses more precision than money has, and says so", () => {
    const parsed = normalizeAmountInput("10.555");
    expect(parsed.tooPrecise).toBe(true);
    expect(parsed.minor).toBeNull();
    // The user's own text survives so they can see and fix it.
    expect(parsed.text).toBe("10.555");
  });

  it("does not round 0.999 up to a rupee", () => {
    expect(normalizeAmountInput("0.999").minor).toBeNull();
  });

  it("never invents a value it wasn't given", () => {
    for (const raw of ["1.005", "99.9999", "0.001"]) {
      expect(normalizeAmountInput(raw).minor, raw).toBeNull();
    }
  });
});

describe("normalizeAmountInput — nonsense", () => {
  it("flags input that isn't an amount", () => {
    for (const raw of ["abc", "1.2.3", "--5", "1e5", "5-", "∞"]) {
      const parsed = normalizeAmountInput(raw);
      expect(parsed.minor, raw).toBeNull();
      expect(parsed.invalid || parsed.tooPrecise, raw).toBe(true);
    }
  });

  it("rejects a negative rather than quietly dropping the sign", () => {
    // Capture never takes a negative; a refund is its own flow. Silently
    // turning "-500" into 500 would file the opposite of what was typed.
    expect(normalizeAmountInput("-500").minor).toBeNull();
    expect(normalizeAmountInput("-500").invalid).toBe(true);
  });

  it("never throws, whatever it is handed", () => {
    for (const raw of ["", "₹", ".", ",", "..", "999999999999999999999"]) {
      expect(() => normalizeAmountInput(raw), raw).not.toThrow();
    }
  });
});

describe("what the field emits is what the schema accepts", () => {
  it("produces only strings the unchanged Zod rule already allows", () => {
    // D2.1 is presentation-only: the field must never hand the form a value
    // the existing validation would reject.
    const inputs = ["500", "1,234.56", "₹1234", "1234.5", ".5", "0", "1,23,456.78"];
    for (const raw of inputs) {
      const { text, minor } = normalizeAmountInput(raw);
      expect(minor, raw).not.toBeNull();
      expect(moneyString.safeParse(text).success, `${raw} → ${text}`).toBe(true);
      // And the two representations agree.
      expect(parseToMinorUnits(text), raw).toBe(minor);
    }
  });
});

describe("formatAmountForDisplay — the resting state", () => {
  it("groups in the Indian system and always shows two places", () => {
    expect(formatAmountForDisplay(123456)).toBe("1,234.56");
    expect(formatAmountForDisplay(12345678)).toBe("1,23,456.78");
    expect(formatAmountForDisplay(50000)).toBe("500.00");
    expect(formatAmountForDisplay(0)).toBe("0.00");
  });

  it("carries no currency symbol — the field renders that separately", () => {
    expect(formatAmountForDisplay(123456)).not.toContain("₹");
  });

  it("round-trips back through the parser", () => {
    for (const minor of [0, 5, 50000, 123456, 12345678]) {
      expect(normalizeAmountInput(formatAmountForDisplay(minor)).minor).toBe(minor);
    }
  });

  it("refuses non-integer minor units", () => {
    expect(() => formatAmountForDisplay(45.5)).toThrow();
  });
});

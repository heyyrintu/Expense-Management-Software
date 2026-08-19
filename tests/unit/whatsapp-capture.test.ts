import { describe, expect, it } from "vitest";
import {
  captureButtons,
  captureSummary,
  decodeButtonPayload,
  encodeButtonPayload,
  formatChatDate,
  merchantFromDescription,
  parseTextExpense,
} from "@/lib/whatsapp/capture";

function amountOf(input: string): number | null {
  const r = parseTextExpense(input);
  return r.ok ? r.expense.amount : null;
}
function descOf(input: string): string | null {
  const r = parseTextExpense(input);
  return r.ok ? r.expense.description : null;
}

describe("text expense parser", () => {
  it("reads a trailing amount", () => {
    expect(parseTextExpense("lunch 450")).toEqual({
      ok: true,
      expense: { amount: 45000, description: "lunch" },
    });
  });

  it("reads a leading amount", () => {
    expect(parseTextExpense("450 lunch")).toEqual({
      ok: true,
      expense: { amount: 45000, description: "lunch" },
    });
  });

  it("handles the rupee sign and Rs/INR prefixes", () => {
    expect(amountOf("₹450 cab")).toBe(45000);
    expect(amountOf("Rs 450 cab")).toBe(45000);
    expect(amountOf("Rs. 450 cab")).toBe(45000);
    expect(amountOf("INR 450 cab")).toBe(45000);
    expect(amountOf("cab ₹450")).toBe(45000);
    expect(descOf("₹450 cab")).toBe("cab");
    expect(descOf("Rs. 450 cab")).toBe("cab");
  });

  it("handles decimals and thousands separators", () => {
    expect(amountOf("dinner 450.75")).toBe(45075);
    expect(amountOf("dinner 450.7")).toBe(45070);
    expect(amountOf("₹1,250 client dinner")).toBe(125000);
    expect(amountOf("₹1,250.50 client dinner")).toBe(125050);
    expect(amountOf("12,34,567 equipment")).toBe(123456700);
  });

  it("keeps money in integer minor units, never floats", () => {
    const r = parseTextExpense("coffee 0.10");
    expect(r.ok && Number.isInteger(r.expense.amount)).toBe(true);
    expect(amountOf("coffee 0.10")).toBe(10);
    expect(amountOf("tea 19.99")).toBe(1999);
  });

  it("prefers the currency-tagged number when there are several", () => {
    expect(amountOf("table 4 lunch ₹450")).toBe(45000);
    expect(descOf("table 4 lunch ₹450")).toBe("table 4 lunch");
  });

  it("refuses to guess between two bare numbers", () => {
    expect(parseTextExpense("table 4 lunch 450")).toEqual({
      ok: false,
      reason: "ambiguous",
    });
    expect(parseTextExpense("₹100 and ₹200")).toEqual({
      ok: false,
      reason: "ambiguous",
    });
  });

  it("rejects empty, amount-less, zero and absurd values", () => {
    expect(parseTextExpense("")).toEqual({ ok: false, reason: "empty" });
    expect(parseTextExpense("   ")).toEqual({ ok: false, reason: "empty" });
    expect(parseTextExpense("hello there")).toEqual({ ok: false, reason: "no_amount" });
    expect(parseTextExpense("lunch 0")).toEqual({ ok: false, reason: "no_amount" });
    expect(parseTextExpense("budget 99999999999")).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("does not treat a number glued to a word as an amount", () => {
    expect(parseTextExpense("uber2go trip").ok).toBe(false);
  });

  it("tidies punctuation left behind by the amount", () => {
    expect(descOf("lunch - 450")).toBe("lunch");
    expect(descOf("450: team snacks")).toBe("team snacks");
    expect(descOf("(450) parking")).toBe("parking");
    expect(descOf("450")).toBe("");
  });

  it("derives a merchant, falling back when there are no words", () => {
    expect(merchantFromDescription("client dinner")).toBe("client dinner");
    expect(merchantFromDescription("")).toBe("WhatsApp expense");
    expect(merchantFromDescription("   ")).toBe("WhatsApp expense");
    expect(merchantFromDescription("x".repeat(100)).length).toBe(60);
  });
});

describe("button payload codec", () => {
  it("round-trips every action", () => {
    for (const action of ["confirm", "edit", "discard"] as const) {
      const payload = encodeButtonPayload(action, "inbound-1");
      expect(decodeButtonPayload(payload)).toEqual({ action, inboundId: "inbound-1" });
    }
  });

  it("rejects junk, foreign and malformed payloads", () => {
    expect(decodeButtonPayload(null)).toBeNull();
    expect(decodeButtonPayload("")).toBeNull();
    expect(decodeButtonPayload("approve:report-1")).toBeNull();
    expect(decodeButtonPayload("wa:confirm")).toBeNull();
    expect(decodeButtonPayload("wa:explode:inbound-1")).toBeNull();
    expect(decodeButtonPayload("wa:confirm:")).toBeNull();
    expect(decodeButtonPayload("xx:confirm:inbound-1")).toBeNull();
  });

  it("offers three buttons in a stable order", () => {
    const buttons = captureButtons("inbound-9");
    expect(buttons.map((b) => decodeButtonPayload(b.id)?.action)).toEqual([
      "confirm",
      "edit",
      "discard",
    ]);
    expect(buttons.every((b) => b.title.length <= 20)).toBe(true);
  });
});

describe("reply copy", () => {
  const date = new Date("2026-08-12T00:00:00.000Z");

  it("summarises merchant, amount and date", () => {
    expect(
      captureSummary({
        merchant: "Blue Tokai",
        amount: 45000,
        currency: "INR",
        date,
        ocrUsed: true,
        amountConfident: true,
      })
    ).toContain("Blue Tokai");
    const summary = captureSummary({
      merchant: "Blue Tokai",
      amount: 45000,
      currency: "INR",
      date,
      ocrUsed: true,
      amountConfident: true,
    });
    expect(summary).toContain("12 Aug");
    expect(summary).toContain("450");
    expect(summary.endsWith("correct?")).toBe(true);
  });

  it("says so plainly when the amount could not be read", () => {
    const summary = captureSummary({
      merchant: "Receipt",
      amount: 1,
      currency: "INR",
      date,
      ocrUsed: true,
      amountConfident: false,
    });
    expect(summary).toContain("couldn't read the amount");
    expect(summary).not.toContain("correct?");
  });

  it("formats chat dates without a year", () => {
    expect(formatChatDate(new Date("2026-01-05T00:00:00Z"))).toBe("5 Jan");
    expect(formatChatDate(new Date("2026-12-31T00:00:00Z"))).toBe("31 Dec");
  });
});

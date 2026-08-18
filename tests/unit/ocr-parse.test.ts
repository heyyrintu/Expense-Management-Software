import { describe, expect, it } from "vitest";
import { parseReceiptText } from "@/lib/ocr/parse";

const RECEIPT = `
Cafe Coffee Day
12, MG Road, Bengaluru
GSTIN: 29AAACC1234F1Z5
Date: 12/08/2026
--------------------------
Cappuccino          180.00
Sandwich            220.00
--------------------------
Subtotal            400.00
CGST 2.5%            10.00
SGST 2.5%            10.00
Grand Total     Rs. 420.00
Thank you, visit again!
`;

describe("parseReceiptText — full receipt", () => {
  const r = parseReceiptText(RECEIPT);

  it("picks the merchant from the header, skipping noise lines", () => {
    expect(r.merchant).toBe("Cafe Coffee Day");
  });
  it("prefers the total line over larger line items", () => {
    expect(r.amount).toBe(42000);
  });
  it("reads dd/mm/yyyy as day-first", () => {
    expect(r.date).toBe("2026-08-12");
  });
});

describe("amounts", () => {
  it("falls back to the largest money value without a total line", () => {
    expect(parseReceiptText("Store\nItem A 120.00\nItem B 340.50").amount).toBe(34050);
  });
  it("handles ₹, commas, and 'Total Amount'", () => {
    expect(parseReceiptText("Shop\nTotal Amount: ₹1,234.56").amount).toBe(123456);
  });
  it("handles amount on the line after 'TOTAL'", () => {
    expect(parseReceiptText("Shop\nTOTAL\n999.99").amount).toBe(99999);
  });
});

describe("dates", () => {
  it("yyyy-mm-dd", () => {
    expect(parseReceiptText("X Cafe\n2026-08-05").date).toBe("2026-08-05");
  });
  it("12 Aug 2026 and Aug 12, 2026", () => {
    expect(parseReceiptText("X Cafe\n12 Aug 2026").date).toBe("2026-08-12");
    expect(parseReceiptText("X Cafe\nAug 12, 2026").date).toBe("2026-08-12");
  });
  it("rejects impossible dates", () => {
    expect(parseReceiptText("X Cafe\n32/13/2026").date).toBeUndefined();
  });
});

describe("merchant heuristics", () => {
  it("skips GSTIN/phone/url lines", () => {
    const r = parseReceiptText("GSTIN 29ABC\nwww.shop.in\nTel: 080-1234\nBig Bazaar\nTotal 100");
    expect(r.merchant).toBe("Big Bazaar");
  });
  it("skips digit-heavy lines", () => {
    expect(parseReceiptText("1234 5678 90\nSpencers Retail\nTotal 50").merchant).toBe(
      "Spencers Retail"
    );
  });
});

describe("graceful emptiness", () => {
  it("empty and garbage text produce {}", () => {
    expect(parseReceiptText("")).toEqual({});
    expect(parseReceiptText("\n\n\n")).toEqual({});
  });
  it("never throws on odd input", () => {
    expect(() => parseReceiptText("....\n%%%%\n----")).not.toThrow();
  });
});

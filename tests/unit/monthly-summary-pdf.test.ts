// The monthly summary document (G3).
//
// A hand-written PDF writer earns its place only if it is verified, so these
// assert the bytes are a STRUCTURALLY VALID PDF — header, object count, an
// xref whose offsets actually point at their objects, and a trailer — not
// merely that a Buffer came back. An invalid PDF fails silently in a mail
// client, which is the same failure mode as the CSV-in-the-body it replaced.
import { describe, expect, it } from "vitest";

import { asciiMoney, buildPdf, pdfEscape } from "@/lib/exports/pdf";
import {
  buildSummaryEmailText,
  buildSummaryPdf,
  summaryFilenames,
  type MonthlySummary,
} from "@/lib/exports/monthly-summary";

const fmt = (minor: number) =>
  `₹${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const SUMMARY: MonthlySummary = {
  monthLabel: "2026-07",
  orgCurrency: "INR",
  totalMinor: 1_234_500,
  expenseCount: 42,
  violationCount: 3,
  topCategories: [
    { name: "Travel", totalMinor: 800_000 },
    { name: "Meals", totalMinor: 300_000 },
    { name: "Software", totalMinor: 134_500 },
  ],
  formatMoney: fmt,
};

/** Parse the xref back out and check each offset lands on "<n> 0 obj". */
function xrefOffsetsAreCorrect(pdf: Buffer): boolean {
  const text = pdf.toString("latin1");
  const xrefIndex = text.lastIndexOf("xref\n");
  if (xrefIndex === -1) return false;
  const lines = text.slice(xrefIndex).split("\n");
  const count = Number(lines[1].split(" ")[1]);
  for (let i = 1; i < count; i += 1) {
    const entry = lines[1 + i + 1];
    if (!entry) return false;
    const offset = Number(entry.slice(0, 10));
    if (!text.startsWith(`${i} 0 obj`, offset)) return false;
  }
  return true;
}

describe("pdfEscape", () => {
  it("escapes the three characters a PDF literal cannot carry raw", () => {
    expect(pdfEscape("a(b)c\\d")).toBe("a\\(b\\)c\\\\d");
  });

  it("octal-escapes Latin-1 so accented names survive", () => {
    expect(pdfEscape("Café")).toBe("Caf\\351");
  });

  it("replaces characters the base-14 fonts cannot show, rather than dropping them", () => {
    // A dropped character silently changes a number; "?" is visibly wrong and
    // gets reported.
    expect(pdfEscape("₹100")).toBe("?100");
    expect(pdfEscape("日本")).toBe("??");
  });
});

describe("asciiMoney", () => {
  it("swaps a symbol for the ISO code", () => {
    expect(asciiMoney("₹1,234.50", "INR")).toBe("INR 1,234.50");
    expect(asciiMoney("$99.00", "USD")).toBe("USD 99.00");
  });

  it("keeps a negative sign", () => {
    expect(asciiMoney("-₹50.00", "INR")).toBe("INR -50.00");
  });

  it("is idempotent-ish on an already-plain number", () => {
    expect(asciiMoney("1,234.50", "INR")).toBe("INR 1,234.50");
  });
});

describe("buildPdf — structural validity", () => {
  const pdf = buildPdf([
    { kind: "heading", text: "Title" },
    { kind: "rule" },
    { kind: "row", label: "Total", value: "INR 1,234.50" },
    { kind: "gap" },
    { kind: "meta", text: "footnote" },
  ]);

  it("starts with a PDF header and ends with EOF", () => {
    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(pdf.subarray(-6).toString("latin1")).toBe("%%EOF\n");
  });

  it("declares all six objects and a catalog root", () => {
    const text = pdf.toString("latin1");
    for (let i = 1; i <= 6; i += 1) expect(text).toContain(`${i} 0 obj`);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Root 1 0 R");
    expect(text).toContain("/Size 7");
  });

  it("has an xref whose every offset points at its object", () => {
    // The assertion that actually matters: a byte-offset table that is one
    // character out produces a file readers reject with no useful message.
    expect(xrefOffsetsAreCorrect(pdf)).toBe(true);
  });

  it("declares a /Length matching the real content stream length", () => {
    const text = pdf.toString("latin1");
    const declared = Number(/\/Length (\d+)/.exec(text)![1]);
    const start = text.indexOf("stream\n") + "stream\n".length;
    const end = text.indexOf("endstream");
    expect(end - start).toBe(declared);
  });

  it("stays byte-accurate when the content contains Latin-1", () => {
    // The reason buildPdf works in Buffers: "é" is two bytes in UTF-8 and one
    // in Latin-1, so a string-length offset would be wrong from there on.
    const withAccent = buildPdf([{ kind: "body", text: "Café Ltd" }]);
    expect(xrefOffsetsAreCorrect(withAccent)).toBe(true);
  });

  it("renders an empty document without producing invalid bytes", () => {
    const empty = buildPdf([]);
    expect(xrefOffsetsAreCorrect(empty)).toBe(true);
    expect(empty.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
  });
});

describe("buildSummaryPdf", () => {
  const pdf = buildSummaryPdf(SUMMARY);
  const text = pdf.toString("latin1");

  it("is a valid PDF", () => {
    expect(xrefOffsetsAreCorrect(pdf)).toBe(true);
  });

  it("carries the headline numbers", () => {
    expect(text).toContain("Monthly expense summary");
    expect(text).toContain("2026-07");
    expect(text).toContain("42"); // expense count
    expect(text).toContain("Policy violations");
  });

  it("writes money with the ISO code, never the rupee glyph", () => {
    // The base-14 fonts have no ₹; writing one would render as a wrong glyph
    // or nothing at all.
    expect(text).toContain("INR 12,345.00");
    expect(text).not.toContain("₹");
  });

  it("lists every top category with its share", () => {
    for (const c of SUMMARY.topCategories) expect(text).toContain(c.name);
    expect(text).toContain("64.8%"); // Travel: 800000 / 1234500
  });

  it("handles a month with no spend rather than dividing by zero", () => {
    const empty = buildSummaryPdf({
      ...SUMMARY,
      totalMinor: 0,
      expenseCount: 0,
      topCategories: [],
    });
    const t = empty.toString("latin1");
    expect(xrefOffsetsAreCorrect(empty)).toBe(true);
    expect(t).toContain("No spend in this period");
    expect(t).not.toContain("NaN");
    expect(t).not.toContain("Infinity");
  });
});

describe("buildSummaryEmailText", () => {
  const body = buildSummaryEmailText(SUMMARY);

  it("summarises rather than pasting a spreadsheet", () => {
    // The G3 regression guard: 300 rows of commas in a body buried the six
    // numbers above them.
    expect(body).not.toContain("--- CSV");
    expect(body.split("\n").length).toBeLessThan(20);
  });

  it("states the headline figures and the category shares", () => {
    expect(body).toContain("Total spend");
    expect(body).toContain("42 expenses");
    expect(body).toContain("Travel");
    expect(body).toContain("64.8%");
  });

  it("tells the reader what is attached", () => {
    expect(body).toMatch(/attached/i);
    expect(body).toMatch(/PDF/);
    expect(body).toMatch(/CSV/);
  });
});

describe("summaryFilenames", () => {
  it("names both files for the month they report", () => {
    const names = summaryFilenames("2026-07");
    expect(names.pdf).toBe("expense-summary-2026-07.pdf");
    expect(names.csv).toBe("expense-detail-2026-07.csv");
  });
});

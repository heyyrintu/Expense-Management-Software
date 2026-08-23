// A minimal, dependency-free PDF writer. Text only, one page, built-in fonts.
//
// ── WHY THIS EXISTS RATHER THAN A LIBRARY ─────────────────────────────────
// PLAN 6.7 asked the monthly summary for "PDF/CSV" and it shipped as CSV
// pasted into an email body (G3). Three ways to fix that:
//
//   1. Render the real screen with its @media print rules. This is the
//      obvious answer and it is wrong here: it needs a headless browser.
//      Playwright is in this repo as a DEV dependency for e2e; promoting it
//      to a runtime dependency of a cron route means shipping ~300 MB of
//      Chromium to render one page of text.
//   2. Add a PDF library (pdfkit, @react-pdf/renderer). Smaller, but still a
//      new runtime dependency and a font pipeline, for a document that is
//      six numbers and a short table.
//   3. Write the bytes. A text-only, single-page PDF using the base-14 fonts
//      is a genuinely small format, and this file is the whole of it.
//
// Option 3, deliberately. The trade is stated so the next person can reverse
// it knowingly: this handles TEXT ON ONE PAGE and nothing else. No images, no
// tables with rules, no page breaks, no embedded fonts. If the summary ever
// needs a chart or a second page, take option 2 — do not grow this.
//
// ── THE ENCODING CONSTRAINT ───────────────────────────────────────────────
// Base-14 fonts use WinAnsi (Latin-1). There is no rupee glyph, so money is
// written as "INR 12,345.67" rather than "₹12,345.67". Embedding a font that
// has ₹ is precisely the dependency this avoids. Callers pass already-
// formatted strings and are responsible for that substitution — see
// `asciiMoney` below.

/** A4 in PostScript points. */
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;

export type PdfLine =
  | { kind: "heading"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "body"; text: string }
  | { kind: "meta"; text: string }
  /** Label left, value right-aligned to the margin — the summary's rows. */
  | { kind: "row"; label: string; value: string }
  | { kind: "gap"; size?: number }
  | { kind: "rule" };

const STYLE = {
  heading: { font: "F2", size: 18, leading: 26 },
  subheading: { font: "F2", size: 12, leading: 20 },
  body: { font: "F1", size: 10, leading: 15 },
  meta: { font: "F1", size: 8, leading: 12 },
  row: { font: "F1", size: 10, leading: 16 },
} as const;

/**
 * Escape a string for a PDF literal and drop anything WinAnsi cannot show.
 *
 * Replacement rather than omission: a missing character silently changes a
 * number, while "?" is visibly wrong and gets reported.
 */
export function pdfEscape(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63;
    if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else if (code >= 32 && code <= 126) out += ch;
    else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return out;
}

/**
 * Money as ASCII: "₹1,234.50" → "INR 1,234.50".
 *
 * The symbol-to-code substitution the base-14 fonts force. Currency codes are
 * arguably better in an emailed accounting document anyway — an accountant
 * reading a summary from a multi-currency tenant should not have to infer
 * which rupee-like symbol was meant.
 */
export function asciiMoney(formatted: string, currency: string): string {
  // Keep digits, separators and the sign; drop everything else, wherever it
  // sits. A leading-prefix strip is not enough: Intl renders a negative INR
  // amount as "-₹50.00", so the symbol comes AFTER the sign and survived —
  // "INR -?50.00" in the PDF, since the base-14 fonts have no rupee glyph.
  // Locales that put the symbol last are handled by the same rule.
  const cleaned = formatted.replace(/[^\d.,\-+]/g, "").trim();
  return `${currency} ${cleaned}`;
}

/** Widths of Helvetica at size 1, approximated. Used only for right-aligning
 *  the value column — a few points of drift is invisible, and the alternative
 *  is embedding a real metrics table for one right edge. */
function approxWidth(text: string, size: number): number {
  // Helvetica averages ~0.5em; digits and caps run wider than lowercase.
  let units = 0;
  for (const ch of text) {
    if (/[.,'’:; ]/.test(ch)) units += 0.28;
    else if (/[ilj|!]/.test(ch)) units += 0.25;
    else if (/[A-Z0-9]/.test(ch)) units += 0.6;
    else units += 0.52;
  }
  return units * size;
}

/**
 * Build a one-page PDF from a list of lines.
 *
 * Returns a Buffer because byte offsets in the xref table must be exact and
 * the content is Latin-1, not UTF-8 — building the document as a JS string
 * and encoding at the end would make every offset past the first non-ASCII
 * character wrong.
 */
export function buildPdf(lines: PdfLine[]): Buffer {
  const ops: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const write = (
    text: string,
    x: number,
    style: { font: string; size: number }
  ) => {
    ops.push(
      `BT /${style.font} ${style.size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(text)}) Tj ET`
    );
  };

  for (const line of lines) {
    if (line.kind === "gap") {
      y -= line.size ?? 10;
      continue;
    }
    if (line.kind === "rule") {
      y -= 6;
      ops.push(
        `0.85 0.85 0.87 RG 0.7 w ${MARGIN} ${y.toFixed(2)} m ${PAGE_WIDTH - MARGIN} ${y.toFixed(2)} l S`
      );
      y -= 10;
      continue;
    }
    if (line.kind === "row") {
      const style = STYLE.row;
      y -= style.leading;
      write(line.label, MARGIN, style);
      const w = approxWidth(line.value, style.size);
      ops.push(
        `BT /F2 ${style.size} Tf 1 0 0 1 ${(PAGE_WIDTH - MARGIN - w).toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(line.value)}) Tj ET`
      );
      continue;
    }
    const style = STYLE[line.kind];
    y -= style.leading;
    write(line.text, MARGIN, style);
  }

  const content = `0 0 0 rg\n${ops.join("\n")}\n`;
  const contentBuf = Buffer.from(content, "latin1");

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${contentBuf.length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  const chunks: Buffer[] = [];
  let offset = 0;
  const push = (s: string) => {
    const b = Buffer.from(s, "latin1");
    chunks.push(b);
    offset += b.length;
  };

  push("%PDF-1.4\n");
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    push(`${i + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  return Buffer.concat(chunks);
}

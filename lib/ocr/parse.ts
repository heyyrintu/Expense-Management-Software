// Pure receipt-text heuristics — unit-tested in tests/unit/ocr-parse.test.ts.
// Best-effort by design (PRD 6.2): wrong guesses are fine, the user reviews
// every value before it lands in the form.
import type { OcrResult } from "./index";

const MONEY = /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:[,0-9]{0,12})?(?:\.[0-9]{1,2})?)/i;
const TOTAL_LINE = /\b(grand\s*total|total\s*(?:amount|due|payable)?|amount\s*(?:due|payable)|balance\s*due)\b/i;
const NOISE_LINE =
  /\b(gst|gstin|cgst|sgst|igst|vat|tax|invoice|receipt|bill|tel|phone|ph|www\.|http|thank|cash|change|card|visa|mastercard|upi|qty|subtotal)\b/i;

function toMinor(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "");
  const m = /^([0-9]{1,13})(?:\.([0-9]{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const whole = Number.parseInt(m[1], 10);
  const frac = m[2] ? Number.parseInt(m[2].padEnd(2, "0"), 10) : 0;
  const minor = whole * 100 + frac;
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function parseAmount(lines: string[]): number | undefined {
  // Prefer money on a "total"-ish line (scanning bottom-up); else the
  // largest money value on the receipt.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (TOTAL_LINE.test(lines[i])) {
      const m = MONEY.exec(lines[i].replace(TOTAL_LINE, ""));
      const v = m ? toMinor(m[1]) : null;
      if (v) return v;
      // amount sometimes sits on the next line
      const next = lines[i + 1] ? MONEY.exec(lines[i + 1]) : null;
      const nv = next ? toMinor(next[1]) : null;
      if (nv) return nv;
    }
  }
  let best: number | undefined;
  for (const line of lines) {
    for (const match of line.matchAll(new RegExp(MONEY.source, "gi"))) {
      const v = toMinor(match[1]);
      if (v && (best === undefined || v > best)) best = v;
    }
  }
  return best;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function ymd(y: number, m: number, d: number): string | undefined {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDate(text: string): string | undefined {
  // yyyy-mm-dd / yyyy/mm/dd
  let m = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (m) {
    const r = ymd(+m[1], +m[2], +m[3]);
    if (r) return r;
  }
  // dd-mm-yyyy / dd/mm/yyyy (Indian convention: day first)
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/.exec(text);
  if (m) {
    const r = ymd(+m[3], +m[2], +m[1]);
    if (r) return r;
  }
  // 12 Aug 2026 | Aug 12, 2026
  m = /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*(20\d{2})\b/i.exec(text);
  if (m) {
    const r = ymd(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    if (r) return r;
  }
  m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\s*,?\s*(20\d{2})\b/i.exec(text);
  if (m) {
    const r = ymd(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    if (r) return r;
  }
  return undefined;
}

function parseMerchant(lines: string[]): string | undefined {
  // First plausible line: not noise, not mostly digits, reasonable length.
  for (const line of lines.slice(0, 6)) {
    const t = line.trim();
    if (t.length < 3 || t.length > 60) continue;
    if (NOISE_LINE.test(t)) continue;
    const digits = (t.match(/\d/g) ?? []).length;
    if (digits > t.length / 3) continue;
    if (!/[a-z]/i.test(t)) continue;
    return t.replace(/\s{2,}/g, " ");
  }
  return undefined;
}

export function parseReceiptText(text: string): OcrResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return {};

  const result: OcrResult = {};
  const merchant = parseMerchant(lines);
  if (merchant) result.merchant = merchant;
  const date = parseDate(text);
  if (date) result.date = date;
  const amount = parseAmount(lines);
  if (amount) result.amount = amount;
  return result;
}

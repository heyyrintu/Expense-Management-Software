// Money = integer minor units (cents/paise). Never floats (CLAUDE.md).
// Parsing is string-based; arithmetic stays in integers throughout.

const MONEY_RE = /^\s*(\d{1,13})(?:\.(\d{1,2}))?\s*$/;

/**
 * Parse a user-entered decimal amount ("12", "12.3", "12.34") into minor
 * units. Returns null for anything else (negative, >2dp, exponents, NaN…).
 */
export function parseToMinorUnits(input: string): number | null {
  const m = MONEY_RE.exec(input);
  if (!m) return null;
  const whole = Number.parseInt(m[1], 10);
  const frac = m[2] ? Number.parseInt(m[2].padEnd(2, "0"), 10) : 0;
  return whole * 100 + frac;
}

/** "1234" minor units → "12.34" (plain decimal string, for form values). */
export function toDecimalString(minor: number): string {
  assertMinorUnits(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Locale/currency display, e.g. formatMoney(123456, "INR") → "₹1,234.56". */
export function formatMoney(minor: number, currency: string): string {
  assertMinorUnits(minor);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    // unknown currency code — fall back to plain decimal
    return `${currency} ${toDecimalString(minor)}`;
  }
}

export function assertMinorUnits(minor: number): void {
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`money: expected integer minor units, got ${minor}`);
  }
}

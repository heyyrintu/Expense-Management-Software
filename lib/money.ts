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

/**
 * Locale/currency display, e.g. formatMoney(123456, "INR") → "₹1,234.56".
 *
 * THE ONLY PLACE MONEY BECOMES A STRING. Components present it via
 * <Amount>; anything that needs a plain string (email bodies, WhatsApp
 * messages, CSV cells, aria labels) calls this directly.
 *
 * `currencySign: "standard"` is explicit, not decorative: the "accounting"
 * sign renders negatives as (₹450.00), and DESIGN-PRD §6.2 requires a minus.
 * Parentheses are invisible at a glance and disappear entirely when a value
 * is read aloud. Asserted in tests/unit/money.test.ts.
 */
export function formatMoney(minor: number, currency: string): string {
  assertMinorUnits(minor);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      currencySign: "standard",
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

// ---------- multi-currency (6.4) ----------

const FX_RATE_RE = /^(\d{1,6})(?:\.(\d{1,6}))?$/;

/** Validate an FX rate string ("83.5", "0.0125"…): 1–6 int + ≤6 frac digits, > 0. */
export function isValidFxRate(rate: string): boolean {
  const m = FX_RATE_RE.exec(rate.trim());
  if (!m) return false;
  return Number.parseInt(m[1], 10) > 0 || (m[2] !== undefined && Number.parseInt(m[2], 10) > 0);
}

/**
 * Convert original-currency minor units to org-base minor units:
 * base = amount × rate, using BANKER'S ROUNDING (round-half-to-even) on the
 * final division — the statistician's default: exact halves round to the
 * nearest even result, so long-run conversion bias cancels out instead of
 * always drifting up. Pure integer math throughout (no floats).
 */
export function convertToBase(amountMinor: number, rate: string): number | null {
  assertMinorUnits(amountMinor);
  const m = FX_RATE_RE.exec(rate.trim());
  if (!m || !isValidFxRate(rate)) return null;
  const frac = m[2] ?? "";
  const rateScaled = BigInt(m[1] + frac.padEnd(frac.length, "")); // digits only
  const scale = BigInt(10) ** BigInt(frac.length);
  if (rateScaled <= 0n) return null;

  const numerator = BigInt(amountMinor) * rateScaled;
  const q = numerator / scale;
  const rem = numerator % scale;
  const twice = rem * 2n;

  let result: bigint;
  if (twice < scale) {
    result = q;
  } else if (twice > scale) {
    result = q + 1n;
  } else {
    // exact half — round to even
    result = q % 2n === 0n ? q : q + 1n;
  }
  const asNumber = Number(result);
  if (!Number.isSafeInteger(asNumber)) return null;
  return asNumber;
}

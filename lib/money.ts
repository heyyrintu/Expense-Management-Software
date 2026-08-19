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

// ---------- input normalisation (D2.1) ----------

/**
 * What a user actually typed or pasted, resolved.
 *
 * `text` is the plain decimal string the form stores and the Zod schema
 * validates — the schema is unchanged, so this only ever produces something
 * it already accepts, or admits failure.
 */
export type AmountInputParse = {
  /** Plain decimal ("1234.56"), or "" when the field is empty. */
  text: string;
  /** Integer minor units, or null when the input isn't a usable amount. */
  minor: number | null;
  /** True when the input carried more precision than money has. */
  tooPrecise: boolean;
  /** True when there was something to read but it wasn't an amount. */
  invalid: boolean;
};

/** Currency symbols and codes people paste along with the number. */
const CURRENCY_NOISE = /(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)/gi;

/**
 * Make sense of a pasted or typed amount: "1,234.56", "₹1234", "Rs 1,234.5",
 * "1234.5", " 500 ".
 *
 * NEVER SILENTLY ROUNDS. "10.555" does not become ₹10.56 — it comes back with
 * `tooPrecise` and no minor value, so the field can say what happened. A cent
 * invented by a text field is a cent nobody can trace, and this is an app
 * whose whole job is that the numbers reconcile.
 *
 * Grouping separators are stripped rather than interpreted: this app formats
 * in en-IN, where "1,23,456.78" is normal, so any comma is a thousands mark
 * and the last dot is the decimal point.
 */
export function normalizeAmountInput(raw: string): AmountInputParse {
  const cleaned = raw
    .replace(CURRENCY_NOISE, "")
    .replace(/[\s  ]/g, "") // spaces, including the narrow no-break kind
    .replace(/,/g, "")
    .trim();

  if (cleaned === "") return { text: "", minor: null, tooPrecise: false, invalid: false };

  // A lone leading dot (".5") is a real way to type half a rupee.
  const withLeadingZero = cleaned.startsWith(".") ? `0${cleaned}` : cleaned;

  const match = /^(\d{1,13})(?:\.(\d*))?$/.exec(withLeadingZero);
  if (!match) {
    return { text: raw.trim(), minor: null, tooPrecise: false, invalid: true };
  }

  const [, whole, frac = ""] = match;
  if (frac.length > 2) {
    // Keep what they typed so they can see and fix it themselves.
    return { text: raw.trim(), minor: null, tooPrecise: true, invalid: false };
  }

  const text = frac.length === 0 ? whole : `${whole}.${frac}`;
  return {
    text,
    minor: Number.parseInt(whole, 10) * 100 + Number.parseInt(frac.padEnd(2, "0") || "0", 10),
    tooPrecise: false,
    invalid: false,
  };
}

/**
 * Grouped display for a resting amount field — "1,23,456.78". Numerals only:
 * the currency symbol is a separate adornment in the input, so repeating it
 * here would print it twice.
 */
export function formatAmountForDisplay(minor: number): string {
  assertMinorUnits(minor);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

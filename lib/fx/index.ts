// FX rate provider (6.4): interface + daily-rate API stub.
//
// ── STILL A STUB, DELIBERATELY ────────────────────────────────────────────
// The numbers below are fixed and will be wrong tomorrow. What changed in
// G6 is REACHABILITY, not accuracy: the table used to be read directly, so
// only the pairs literally written in it resolved. `getFxRate("INR","USD")`
// returned null, and a USD-based tenant — every one of whose expenses needs
// INR→USD or EUR→USD — got no prefill at all, on every expense, forever.
// A stub that silently serves one tenant's currency is worse than an honest
// stub, because the gap looks like a bug in the form.
//
// So the table stays a single column of X → INR quotes (one number per
// currency, no matrix to keep internally consistent) and everything else is
// DERIVED:
//
//     from === to        → "1"
//     X → INR            → the quote
//     INR → X            → 1 / quote            (inversion)
//     X → Y              → quote(X) / quote(Y)  (cross-rate through INR)
//
// A real provider replaces `quotesPerBase` behind the same function and the
// derivation stops mattering. Until then the manual override on the form is
// the real answer for anything that must be exact — which is why a wrong-ish
// prefill is acceptable and a MISSING one is not.

/** Currencies offered in the picker (all 2-decimal minor units). */
export const SUPPORTED_CURRENCIES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "CAD",
] as const;

/**
 * The stub's one column: how many BASE units one unit of the currency buys.
 *
 * INR is the base and is 1 by definition. Keeping a single column rather than
 * a from→to matrix means there is no way for the table to disagree with
 * itself — a matrix with USD→EUR written independently of USD→INR and
 * EUR→INR is three numbers that drift apart the first time one is edited.
 */
const STUB_BASE = "INR";
const quotesPerBase: Record<string, number> = {
  INR: 1,
  USD: 83.5,
  EUR: 90.25,
  GBP: 105.8,
  AED: 22.73,
  SGD: 62.1,
  AUD: 55.4,
  CAD: 61.15,
};

/**
 * Six decimal places, trailing zeros trimmed.
 *
 * Six because `isValidFxRate` in lib/money.ts accepts at most six fractional
 * digits, and an inverted rate is almost always irrational — INR→USD is
 * 0.011976..., which at two decimals would be 0.01 and price a $1,000 expense
 * at ₹100,000 instead of ₹83,500.
 */
function toRateString(rate: number): string | null {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const fixed = rate.toFixed(6);
  const trimmed = fixed.replace(/\.?0+$/, "");
  // isValidFxRate caps the integer part at six digits. Nothing in
  // SUPPORTED_CURRENCIES comes close, but a future quote might.
  const [int] = trimmed.split(".");
  if (int.replace("-", "").length > 6) return null;
  return trimmed === "" || trimmed === "0" ? null : trimmed;
}

/**
 * Rate converting `from` into `to`, or null when unknown (manual entry).
 *
 * `null` still means "the form asks the user", and that path is unchanged —
 * an unsupported currency, or a real provider that is down, must not produce
 * a confident wrong number.
 */
export async function getFxRate(from: string, to: string): Promise<string | null> {
  if (from === to) return "1";

  const fromQuote = quotesPerBase[from];
  const toQuote = quotesPerBase[to];
  if (fromQuote === undefined || toQuote === undefined) return null;

  // One expression covers all three cases. X→INR is toQuote === 1, INR→X is
  // fromQuote === 1, and the general cross-rate is the same division — so
  // there is no branch that can be right for one direction and wrong for the
  // other, which is exactly how the original table went one-way.
  return toRateString(fromQuote / toQuote);
}

/** The stub's base currency. Exported so a test can state the assumption
 *  rather than hard-coding "INR" in three places. */
export const STUB_BASE_CURRENCY = STUB_BASE;

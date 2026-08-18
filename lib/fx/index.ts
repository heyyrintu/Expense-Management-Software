// FX rate provider (6.4): interface + daily-rate API stub. The stub returns
// fixed test rates; a real provider (e.g. exchangerate.host / RBI reference
// rates) can replace `stubRates` behind the same function. A null rate means
// the user must enter one manually — the form always allows an override.

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

const stubRates: Record<string, Record<string, string>> = {
  // from → to → rate (decimal string)
  USD: { INR: "83.50" },
  EUR: { INR: "90.25" },
  GBP: { INR: "105.80" },
  AED: { INR: "22.73" },
  SGD: { INR: "62.10" },
  AUD: { INR: "55.40" },
  CAD: { INR: "61.15" },
};

/** Rate converting `from` into `to`, or null when unknown (manual entry). */
export async function getFxRate(from: string, to: string): Promise<string | null> {
  if (from === to) return "1";
  return stubRates[from]?.[to] ?? null;
}

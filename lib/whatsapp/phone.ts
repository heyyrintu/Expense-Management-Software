// Phone-number normalization — pure. WhatsApp identifies users by an E.164
// number WITHOUT the plus (Meta's "wa_id"), so we keep a canonical +E.164
// form for storage/display and a bare-digits form for the API.
//
// Indian numbers are the common case here: a 10-digit local number gets the
// default country code, and the leading 0 of a trunk-prefixed number is
// dropped.

export const DEFAULT_COUNTRY_CODE = "91";

export type PhoneResult =
  | { ok: true; e164: string; digits: string }
  | { ok: false; error: string };

/**
 * Accepts "+91 98765 43210", "09876543210", "9876543210", "919876543210"
 * and returns "+919876543210".
 */
export function normalizePhone(
  input: string,
  defaultCc: string = DEFAULT_COUNTRY_CODE
): PhoneResult {
  const raw = (input ?? "").trim();
  if (raw.length === 0) return { ok: false, error: "Enter a phone number." };

  const hadPlus = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 0) return { ok: false, error: "Enter a phone number." };

  if (!hadPlus) {
    // Trunk prefix: 0XXXXXXXXXX -> local number.
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    // Bare local number -> prepend the default country code.
    if (digits.length === 10) digits = `${defaultCc}${digits}`;
  }

  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: "That doesn't look like a valid phone number." };
  }
  if (digits.startsWith("0")) {
    return { ok: false, error: "Include the country code, e.g. +91 98765 43210." };
  }
  return { ok: true, e164: `+${digits}`, digits };
}

/** Meta sends wa_id as bare digits; store everything as +E.164. */
export function fromWaId(waId: string): string {
  const digits = (waId ?? "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

/** Bare digits for Graph API payloads. */
export function toWaId(e164: string): string {
  return (e164 ?? "").replace(/\D/g, "");
}

/** Display form: +91 98765 43210 (grouping is cosmetic only). */
export function formatPhone(e164: string): string {
  const digits = toWaId(e164);
  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return `+${DEFAULT_COUNTRY_CODE} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return e164;
}

/** Masked form for anywhere a number is shown outside its owner's profile. */
export function maskPhone(e164: string): string {
  const digits = toWaId(e164);
  if (digits.length < 4) return "••••";
  return `••••••${digits.slice(-4)}`;
}

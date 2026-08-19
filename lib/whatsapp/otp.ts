// Number-linking OTP rules — pure, unit-tested. The code itself is never
// stored: only a SHA-256 hash, with an expiry and an attempt ceiling.
import { createHash, randomInt } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export type OtpState = {
  otpHash: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
  verifiedAt?: Date | null;
};

export type OtpCheck =
  | { ok: true }
  | { ok: false; error: string; attemptsLeft: number; exhausted: boolean };

/**
 * Verify a submitted code against stored state. Attempts are counted by the
 * caller on failure; exhausted/expired states force a fresh code rather than
 * letting someone grind through the space.
 */
export function checkOtp(
  state: OtpState,
  submitted: string,
  now: Date = new Date()
): OtpCheck {
  const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - state.otpAttempts);
  if (!state.otpHash || !state.otpExpiresAt) {
    return {
      ok: false,
      error: "Ask for a new code to continue.",
      attemptsLeft,
      exhausted: true,
    };
  }
  if (state.otpAttempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many wrong codes. Request a new one.",
      attemptsLeft: 0,
      exhausted: true,
    };
  }
  if (state.otpExpiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      error: "That code has expired. Request a new one.",
      attemptsLeft,
      exhausted: true,
    };
  }
  const code = (submitted ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return {
      ok: false,
      error: "Enter the 6-digit code.",
      attemptsLeft: attemptsLeft - 1,
      exhausted: attemptsLeft - 1 <= 0,
    };
  }
  if (hashOtp(code) !== state.otpHash) {
    const left = attemptsLeft - 1;
    return {
      ok: false,
      error: left > 0 ? "That code isn't right." : "Too many wrong codes. Request a new one.",
      attemptsLeft: Math.max(0, left),
      exhausted: left <= 0,
    };
  }
  return { ok: true };
}

export function otpExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_MS);
}

export function otpMessage(code: string, orgName: string): string {
  return `${code} is your ${orgName} expenses verification code. It expires in 10 minutes. If you didn't ask for it, ignore this message.`;
}

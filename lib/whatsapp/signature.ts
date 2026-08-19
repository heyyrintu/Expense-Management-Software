// X-Hub-Signature-256 verification — pure, unit-tested.
// Meta signs the RAW request body with the app secret: sha256=<hex hmac>.
import { createHmac, timingSafeEqual } from "node:crypto";

export function computeSignature(rawBody: string, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

/**
 * Constant-time compare of the header against a freshly computed signature.
 * Returns false for a missing header, wrong prefix, or wrong length — never
 * throws, so a malformed request is simply unauthenticated.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = Buffer.from(computeSignature(rawBody, appSecret));
  const received = Buffer.from(signatureHeader);
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

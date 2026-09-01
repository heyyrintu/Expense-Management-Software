// Symmetric encryption for credentials at rest (8.1).
//
// AES-256-GCM with a random 96-bit IV per value; the auth tag is stored with
// the ciphertext, so tampering fails closed on decrypt. The key comes from
// APP_ENCRYPTION_KEY (32 bytes, base64 or hex) and never touches the database.
//
// Format: v1.<iv-b64>.<tag-b64>.<ciphertext-b64>
import { encryptionKey } from "./key";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;

// Key parsing lives in ./key so lib/env can validate at boot without
// pulling node:crypto into the edge bundle. Re-exported here so existing
// call sites and tests keep importing it from secret-box.
export {
  MissingEncryptionKeyError,
  encryptionKey,
  hasEncryptionKey,
} from "./key";

export function encryptSecret(plaintext: string, key = encryptionKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    enc.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string, key = encryptionKey()): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted value.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Never throws — returns null for absent or undecryptable values. */
export function tryDecryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}

/** Constant-time string compare (verify tokens, OTP hashes). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Last-4 preview for credentials shown back in settings. */
export function maskSecret(value: string | null): string {
  if (!value) return "—";
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

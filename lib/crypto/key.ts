// APP_ENCRYPTION_KEY parsing, deliberately split out of secret-box.ts.
//
// secret-box imports node:crypto for the cipher. lib/env needs to VALIDATE
// the key at boot, and instrumentation.ts is compiled for the edge runtime
// as well as node — so importing secret-box from there dragged node:crypto
// into a bundle that cannot resolve `node:` schemes and broke `next dev`
// with "Reading from node:crypto is not handled by plugins".
//
// Parsing needs only Buffer, so it lives here and secret-box re-exports it.
// One implementation still, which is the point: a 64-character hex string
// is ALSO valid base64, and a second implementation gets that wrong.

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super("APP_ENCRYPTION_KEY is not set — cannot store credentials.");
    this.name = "MissingEncryptionKeyError";
  }
}

/** 32-byte key from base64 or hex. Throws when absent/mis-sized. */
export function encryptionKey(raw = process.env.APP_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new MissingEncryptionKeyError();
  const buf = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return buf;
}

export function hasEncryptionKey(raw = process.env.APP_ENCRYPTION_KEY): boolean {
  try {
    encryptionKey(raw);
    return true;
  } catch {
    return false;
  }
}

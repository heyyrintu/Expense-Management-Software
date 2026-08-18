// Stateless invite tokens: HMAC-SHA256 signed { userId, orgId, exp } —
// no schema change needed. Secret defaults to AUTH_SECRET.
// Pure given an explicit secret — unit-tested in tests/unit/invite-token.test.ts.
import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Payload = { u: string; o: string; exp: number };

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

function getSecret(secret?: string): string {
  const s = secret ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("invite-token: AUTH_SECRET is not set");
  return s;
}

export function createInviteToken(
  userId: string,
  orgId: string,
  opts?: { ttlMs?: number; secret?: string; now?: number }
): string {
  const payload: Payload = {
    u: userId,
    o: orgId,
    exp: (opts?.now ?? Date.now()) + (opts?.ttlMs ?? DEFAULT_TTL_MS),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${sign(body, getSecret(opts?.secret))}`;
}

export function verifyInviteToken(
  token: string,
  opts?: { secret?: string; now?: number }
): { userId: string; orgId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body, getSecret(opts?.secret));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as Payload;
    if (
      typeof payload.u !== "string" ||
      typeof payload.o !== "string" ||
      typeof payload.exp !== "number" ||
      (opts?.now ?? Date.now()) > payload.exp
    ) {
      return null;
    }
    return { userId: payload.u, orgId: payload.o };
  } catch {
    return null;
  }
}

// Per-org / per-key sliding-window rate limiter (noisy-neighbor guard,
// PRD §10). Injectable clock for unit tests.
//
// ── READ THIS BEFORE SCALING OUT ─────────────────────────────────────────
// The counters live in THIS PROCESS's memory. That is correct for exactly
// one long-lived instance and wrong for anything else:
//
//   - N instances behind a load balancer => roughly N x every limit here,
//     because each keeps its own count and none of them agree.
//   - On serverless (Vercel, Lambda) instances are created and destroyed
//     per burst of traffic, so a fresh process starts at zero. The login
//     limit of 10/min is then close to no limit at all, which matters:
//     it is the only thing rate-limiting password guessing.
//
// Moving to a shared store is a real change, not a config flag — see
// docs/PRODUCTION-CHECKLIST.md. Until then, run ONE instance, or treat
// these numbers as advisory and put the real limit in front of the app.

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 60_000 }, // per slug+ip
  signup: { limit: 5, windowMs: 60 * 60_000 }, // per ip
  upload: { limit: 60, windowMs: 60_000 }, // per org
  export: { limit: 10, windowMs: 60_000 }, // per org
  mutation: { limit: 300, windowMs: 60_000 }, // per org, coarse guard
  whatsappInbound: { limit: 30, windowMs: 60_000 }, // per sending number
  whatsappReply: { limit: 3, windowMs: 10 * 60_000 }, // canned replies per number
  whatsappOtp: { limit: 5, windowMs: 60 * 60_000 }, // OTP sends per user
} as const satisfies Record<string, RateLimitRule>;

/**
 * Returns true when the call is ALLOWED (and records it), false when the
 * key has exhausted its window.
 */
export function checkRateLimit(
  scope: keyof typeof RATE_LIMITS,
  key: string,
  now: number = Date.now()
): boolean {
  const rule = RATE_LIMITS[scope];
  const id = `${scope}:${key}`;

  // opportunistic cleanup so the map can't grow unbounded
  if (now - lastSweep > 5 * 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (b.timestamps.length === 0 || now - b.timestamps[b.timestamps.length - 1] > 60 * 60_000) {
        buckets.delete(k);
      }
    }
  }

  const bucket = buckets.get(id) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < rule.windowMs);
  if (bucket.timestamps.length >= rule.limit) {
    buckets.set(id, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  buckets.set(id, bucket);
  return true;
}

/** Test hook. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const rateLimitedMessage =
  "Too many requests — please wait a moment and try again.";

// Per-org / per-key rate limiter (noisy-neighbor and brute-force guard,
// PRD §10).
//
// ── WHY THIS IS IN POSTGRES ──────────────────────────────────────────────
// This used to keep its counters in a Map in the serving process. That is
// correct for exactly one long-lived instance and wrong for anything else:
// N instances behind a load balancer each kept their own count and none of
// them agreed, so the real limit was roughly N x the number below. On
// serverless it was worse — instances are created and destroyed per burst,
// so a fresh process started at zero and the login limit, the only thing
// rate-limiting password guessing, was close to no limit at all.
//
// The store is Postgres rather than Redis because the database is already
// there. Redis would be faster, but "add infrastructure" is a decision the
// deployment has not made yet, and a limiter that only works once someone
// provisions Redis is a limiter that does not work.
//
// ── THE ALGORITHM, AND WHAT IT TRADES ────────────────────────────────────
// A weighted sliding-window counter: one row per (scope, key, window),
// with the previous window's count weighted by how much of it still
// overlaps the trailing window. The old implementation kept a timestamp per
// request, which is exact — but exactness would mean a row per request, and
// at `mutation`'s 300/min/org the limiter would write more than the work it
// guards. This is the standard approximation and is accurate to within a
// fraction of the limit at window boundaries.
//
// The counter is incremented BEFORE the decision, so a refused call still
// counts. That is deliberate for the brute-force cases: an attacker must
// not be able to probe for free once they are over the line.
// The RAW client, not scopedDb: these counters have no org_id, and the
// login/signup keys are recorded before any session exists.
import { prisma } from "./db/client";

type Rule = { limit: number; windowMs: number };
export type RateLimitRule = Rule;

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

export type RateLimitScope = keyof typeof RATE_LIMITS;

/** Start of the fixed window `now` falls in. Pure. */
export function windowStartFor(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * The decision, separated from the storage so it can be tested without a
 * database. `current` already INCLUDES the call being decided.
 *
 * The previous window is weighted by the share of it still inside the
 * trailing window: one tick into a new window almost all of the previous
 * one still counts; one tick before the next, almost none of it does.
 */
export function rateLimitAllows(
  rule: Rule,
  current: number,
  previous: number,
  elapsedInWindowMs: number
): boolean {
  const overlap = 1 - Math.min(elapsedInWindowMs, rule.windowMs) / rule.windowMs;
  return previous * overlap + current <= rule.limit;
}

type Row = { current: number | bigint; previous: number | bigint };

/**
 * Returns true when the call is ALLOWED (and records it), false when the
 * key has exhausted its window.
 *
 * One statement, one round trip: the increment, the previous window's count
 * and a prune of this key's stale rows. The prune keeps a key to at most two
 * rows without needing a global sweep — abandoned keys are cleared by
 * pruneRateLimits() from the daily job.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  key: string,
  now: number = Date.now()
): Promise<boolean> {
  const rule = RATE_LIMITS[scope];
  const start = windowStartFor(now, rule.windowMs);
  const currentWindow = new Date(start);
  const previousWindow = new Date(start - rule.windowMs);

  const rows = await prisma.$queryRaw<Row[]>`
    WITH pruned AS (
      DELETE FROM "rate_limit_counters"
       WHERE "scope" = ${scope} AND "key" = ${key}
         AND "window_start" < ${previousWindow}
    ), bumped AS (
      INSERT INTO "rate_limit_counters" ("scope", "key", "window_start", "count")
      VALUES (${scope}, ${key}, ${currentWindow}, 1)
      ON CONFLICT ("scope", "key", "window_start")
      DO UPDATE SET "count" = "rate_limit_counters"."count" + 1
      RETURNING "count"
    )
    SELECT
      (SELECT "count" FROM bumped) AS "current",
      COALESCE((SELECT "count" FROM "rate_limit_counters"
                 WHERE "scope" = ${scope} AND "key" = ${key}
                   AND "window_start" = ${previousWindow}), 0) AS "previous"
  `;

  const row = rows[0];
  if (!row) return true; // no row means no statement ran; do not lock people out
  return rateLimitAllows(
    rule,
    Number(row.current),
    Number(row.previous),
    now - start
  );
}

/**
 * Drops counters nothing will read again. Called from the daily job — the
 * per-key prune above bounds ACTIVE keys, this clears the ones that went
 * quiet (an IP that signed up once and never returned).
 */
export async function pruneRateLimits(now: number = Date.now()): Promise<number> {
  const widest = Math.max(...Object.values(RATE_LIMITS).map((r) => r.windowMs));
  const cutoff = new Date(now - widest * 2);
  const deleted = await prisma.rateLimitCounter.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return deleted.count;
}

/** Test hook — clears every counter. */
export async function resetRateLimits(): Promise<void> {
  await prisma.rateLimitCounter.deleteMany({});
}

export const rateLimitedMessage =
  "Too many requests — please wait a moment and try again.";

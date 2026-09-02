// The rate limiter against a real database.
//
// This suite exists because the limiter's correctness IS its storage. The
// previous implementation passed every unit test while being effectively
// disabled in production: counters lived in one process's memory, so N
// instances meant roughly N x every limit and a serverless deploy reset them
// per burst. Nothing that ran without a database could tell the difference.
//
// It runs as the APP ROLE (DATABASE_URL), which also proves the grant: the
// role owns nothing, and a missing GRANT on rate_limit_counters would take
// down login rather than merely stop limiting it.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  pruneRateLimits,
  RATE_LIMITS,
  resetRateLimits,
} from "@/lib/rate-limit";
import { scopedDb } from "@/lib/db/scoped";
import { owner } from "./helpers";

// Boundary-aligned so a test never straddles two windows by accident.
const T0 = 4_000_000 * 60_000;

beforeEach(async () => {
  await resetRateLimits();
});
afterEach(async () => {
  await resetRateLimits();
});

describe("rate limiter — shared store", () => {
  it("allows up to the limit inside a window, then refuses", async () => {
    for (let i = 0; i < RATE_LIMITS.export.limit; i++) {
      expect(await checkRateLimit("export", "orgA", T0 + i)).toBe(true);
    }
    expect(await checkRateLimit("export", "orgA", T0 + 100)).toBe(false);
  });

  // THE POINT OF THE WHOLE CHANGE. The count is in Postgres, so any other
  // instance reads the same number instead of starting its own at zero.
  it("keeps the count in the database, not in this process", async () => {
    for (let i = 0; i < 4; i++) await checkRateLimit("export", "orgA", T0);

    const rows = (await owner.rateLimitCounter.findMany({
      where: { scope: "export", key: "orgA" },
    })) as Array<{ count: number }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(4);
  });

  it("counts refused calls too, so being over the line is not free", async () => {
    for (let i = 0; i < RATE_LIMITS.export.limit + 3; i++) {
      await checkRateLimit("export", "orgA", T0);
    }
    const rows = (await owner.rateLimitCounter.findMany({
      where: { scope: "export", key: "orgA" },
    })) as Array<{ count: number }>;
    expect(rows[0].count).toBe(RATE_LIMITS.export.limit + 3);
  });

  it("keys are independent — one org cannot exhaust another's budget", async () => {
    for (let i = 0; i < RATE_LIMITS.export.limit; i++) {
      await checkRateLimit("export", "orgA", T0);
    }
    expect(await checkRateLimit("export", "orgA", T0)).toBe(false);
    expect(await checkRateLimit("export", "orgB", T0)).toBe(true);
  });

  it("scopes are independent for the same key", async () => {
    for (let i = 0; i < RATE_LIMITS.export.limit; i++) {
      await checkRateLimit("export", "orgA", T0);
    }
    expect(await checkRateLimit("export", "orgA", T0)).toBe(false);
    expect(await checkRateLimit("upload", "orgA", T0)).toBe(true);
  });

  it("frees the budget up as the window slides past", async () => {
    for (let i = 0; i < RATE_LIMITS.export.limit; i++) {
      await checkRateLimit("export", "orgA", T0);
    }
    expect(await checkRateLimit("export", "orgA", T0 + 1)).toBe(false);
    // A full window later the earlier calls have decayed out entirely.
    const w = RATE_LIMITS.export.windowMs;
    expect(await checkRateLimit("export", "orgA", T0 + 2 * w)).toBe(true);
  });

  it("keeps a busy key to at most two rows", async () => {
    const w = RATE_LIMITS.export.windowMs;
    for (const t of [T0, T0 + w, T0 + 2 * w, T0 + 3 * w]) {
      await checkRateLimit("export", "orgA", t);
    }
    const rows = await owner.rateLimitCounter.findMany({
      where: { scope: "export", key: "orgA" },
    });
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  it("prunes counters nothing will read again", async () => {
    await checkRateLimit("export", "orgA", T0);
    expect(await owner.rateLimitCounter.count()).toBeGreaterThan(0);
    // Far enough past the widest window that every counter is dead.
    await pruneRateLimits(T0 + 30 * 24 * 60 * 60_000);
    expect(await owner.rateLimitCounter.count()).toBe(0);
  });

  // It has no org_id — the login and signup keys are IPs recorded before a
  // session exists — so reaching it through a tenant scope is a category
  // error, and scopeArgs refuses rather than inventing an orgId filter.
  it("is unreachable from a tenant scope", async () => {
    const db = scopedDb("01a00000-0000-7000-8000-000000000000") as unknown as {
      rateLimitCounter: { findMany: () => Promise<unknown> };
    };
    await expect(db.rateLimitCounter.findMany()).rejects.toThrow();
  });
});

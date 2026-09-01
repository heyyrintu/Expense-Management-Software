// The limiter's DECISION, tested without a database.
//
// The storage half moved to Postgres (counters have to be shared across
// instances, or N instances mean N x every limit), so the behavioural tests
// live in tests/isolation/rate-limit.test.ts where a database exists. What
// is left here is the arithmetic, which is where the interesting edge is.
import { describe, expect, it } from "vitest";
import {
  RATE_LIMITS,
  rateLimitAllows,
  windowStartFor,
} from "@/lib/rate-limit";

const RULE = { limit: 10, windowMs: 60_000 };

describe("windowStartFor", () => {
  it("floors to the window boundary", () => {
    expect(windowStartFor(60_000, 60_000)).toBe(60_000);
    expect(windowStartFor(60_001, 60_000)).toBe(60_000);
    expect(windowStartFor(119_999, 60_000)).toBe(60_000);
    expect(windowStartFor(120_000, 60_000)).toBe(120_000);
  });

  it("gives adjacent calls the same window until it rolls", () => {
    // Anchored ON a boundary: 1_000_000 is 40s INTO a window, so +59s would
    // cross into the next one and the assertion would be about the clock
    // rather than the function.
    const base = windowStartFor(1_000_000, 60_000);
    expect(windowStartFor(base, 60_000)).toBe(base);
    expect(windowStartFor(base + 59_999, 60_000)).toBe(base);
    expect(windowStartFor(base + 60_000, 60_000)).toBe(base + 60_000);
  });
});

describe("rateLimitAllows", () => {
  // `current` INCLUDES the call being decided, so at exactly the limit the
  // call is still allowed and the next one is not.
  it("allows up to the limit and refuses past it", () => {
    expect(rateLimitAllows(RULE, 10, 0, 0)).toBe(true);
    expect(rateLimitAllows(RULE, 11, 0, 0)).toBe(false);
  });

  it("counts the whole previous window at the boundary", () => {
    // One tick into a new window, essentially all of the previous window is
    // still inside the trailing window — so a full previous window plus one
    // new call is over the line.
    expect(rateLimitAllows(RULE, 1, 10, 0)).toBe(false);
  });

  it("stops counting the previous window as it slides out", () => {
    // Same 10 in the previous window, but almost a full window later: its
    // weight has decayed to nothing and the budget is free again.
    expect(rateLimitAllows(RULE, 1, 10, 59_999)).toBe(true);
  });

  it("weights the previous window proportionally", () => {
    // Half a window elapsed: 8 previous count as 4, so 4 + 6 = 10 is the
    // last allowed call and 4 + 7 = 11 is not.
    expect(rateLimitAllows(RULE, 6, 8, 30_000)).toBe(true);
    expect(rateLimitAllows(RULE, 7, 8, 30_000)).toBe(false);
  });

  it("never lets elapsed beyond the window make the weight negative", () => {
    // Clock skew or a long-delayed call must not turn the previous window
    // into a NEGATIVE contribution and hand out extra budget.
    expect(rateLimitAllows(RULE, 11, 50, 10 * 60_000)).toBe(false);
  });

  it("holds for every configured scope at its own limit", () => {
    for (const rule of Object.values(RATE_LIMITS)) {
      expect(rateLimitAllows(rule, rule.limit, 0, 0)).toBe(true);
      expect(rateLimitAllows(rule, rule.limit + 1, 0, 0)).toBe(false);
    }
  });
});

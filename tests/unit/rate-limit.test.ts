import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  RATE_LIMITS,
  resetRateLimits,
} from "@/lib/rate-limit";

beforeEach(() => resetRateLimits());

describe("rate limiter", () => {
  it("allows up to the limit then blocks within the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMITS.export.limit; i++) {
      expect(checkRateLimit("export", "org1", t0 + i)).toBe(true);
    }
    expect(checkRateLimit("export", "org1", t0 + 100)).toBe(false);
  });

  it("frees up as the window slides", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMITS.export.limit; i++) {
      checkRateLimit("export", "org1", t0);
    }
    expect(checkRateLimit("export", "org1", t0 + 1)).toBe(false);
    expect(
      checkRateLimit("export", "org1", t0 + RATE_LIMITS.export.windowMs + 1)
    ).toBe(true);
  });

  it("keys are independent (org isolation of the guard itself)", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMITS.export.limit; i++) {
      checkRateLimit("export", "org1", t0);
    }
    expect(checkRateLimit("export", "org1", t0 + 1)).toBe(false);
    expect(checkRateLimit("export", "org2", t0 + 1)).toBe(true);
  });

  it("scopes are independent for the same key", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMITS.export.limit; i++) {
      checkRateLimit("export", "k", t0);
    }
    expect(checkRateLimit("export", "k", t0 + 1)).toBe(false);
    expect(checkRateLimit("upload", "k", t0 + 1)).toBe(true);
  });
});

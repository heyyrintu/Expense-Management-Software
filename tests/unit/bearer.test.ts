import { describe, expect, it } from "vitest";
import { bearerMatches } from "@/lib/auth/bearer";

describe("bearerMatches", () => {
  it("accepts the exact header", () => {
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("rejects a wrong secret, a wrong scheme and a bare token", () => {
    expect(bearerMatches("Bearer nope", "s3cret")).toBe(false);
    expect(bearerMatches("Basic s3cret", "s3cret")).toBe(false);
    expect(bearerMatches("s3cret", "s3cret")).toBe(false);
  });

  // The reason this helper exists: an unconfigured deployment must not
  // expose an open endpoint that mutates every org's data.
  it("fails closed when the secret is unset or empty", () => {
    expect(bearerMatches("Bearer anything", undefined)).toBe(false);
    expect(bearerMatches("Bearer ", "")).toBe(false);
  });

  it("rejects a missing header without throwing", () => {
    expect(bearerMatches(null, "s3cret")).toBe(false);
  });

  // timingSafeEqual throws on a length mismatch, so the length guard has to
  // run first — a prefix of the real secret must return false, not crash.
  it("handles a length mismatch", () => {
    expect(bearerMatches("Bearer s3cre", "s3cret")).toBe(false);
    expect(bearerMatches("Bearer s3cretttt", "s3cret")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  createInviteToken,
  verifyInviteToken,
} from "@/lib/auth/invite-token";

const SECRET = "test-secret";
const USER = "0198c5f2-0000-7000-8000-00000000u001";
const ORG = "0198c5f2-0000-7000-8000-00000000o001";

describe("invite tokens", () => {
  it("round-trips userId + orgId", () => {
    const token = createInviteToken(USER, ORG, { secret: SECRET });
    expect(verifyInviteToken(token, { secret: SECRET })).toEqual({
      userId: USER,
      orgId: ORG,
    });
  });

  it("rejects a tampered payload", () => {
    const token = createInviteToken(USER, ORG, { secret: SECRET });
    const [body, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ u: USER, o: "other-org", exp: Date.now() + 1e6 })
    ).toString("base64url");
    expect(verifyInviteToken(`${forged}.${sig}`, { secret: SECRET })).toBeNull();
    expect(verifyInviteToken(`${body}.AAAA`, { secret: SECRET })).toBeNull();
  });

  it("rejects the wrong secret", () => {
    const token = createInviteToken(USER, ORG, { secret: SECRET });
    expect(verifyInviteToken(token, { secret: "other" })).toBeNull();
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const token = createInviteToken(USER, ORG, {
      secret: SECRET,
      ttlMs: 1000,
      now,
    });
    expect(verifyInviteToken(token, { secret: SECRET, now: now + 999 })).not.toBeNull();
    expect(verifyInviteToken(token, { secret: SECRET, now: now + 1001 })).toBeNull();
  });

  it("rejects garbage", () => {
    for (const bad of ["", "a", "a.b", "a.b.c"]) {
      expect(verifyInviteToken(bad, { secret: SECRET })).toBeNull();
    }
  });
});

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  findOurRecipient,
  normalizeSender,
  parseInboundAddress,
  subjectToPurpose,
} from "@/lib/inbound-email/address";
import { verifyMailgunSignature } from "@/lib/inbound-email/mailgun";

const DOMAIN = "mail.exp.app";

describe("parseInboundAddress", () => {
  it("accepts receipts+slug@domain incl. angle-bracket forms", () => {
    expect(parseInboundAddress("receipts+acme@mail.exp.app", DOMAIN)).toEqual({ slug: "acme" });
    expect(parseInboundAddress("Receipts+ACME@MAIL.EXP.APP", DOMAIN)).toEqual({ slug: "acme" });
    expect(parseInboundAddress("Expenses <receipts+glo-bex@mail.exp.app>", DOMAIN)).toEqual({ slug: "glo-bex" });
  });
  it("rejects other locals, domains, and bad slugs", () => {
    for (const bad of [
      "receipts@mail.exp.app",
      "invoices+acme@mail.exp.app",
      "receipts+acme@evil.com",
      "receipts+@mail.exp.app",
      "receipts+-bad-@mail.exp.app",
      "receipts+a@mail.exp.app", // too short
      "notanaddress",
    ]) {
      expect(parseInboundAddress(bad, DOMAIN), bad).toBeNull();
    }
  });
  it("findOurRecipient picks ours from a list", () => {
    expect(
      findOurRecipient(["boss@corp.com", "receipts+acme@mail.exp.app"], DOMAIN)
    ).toEqual({ slug: "acme" });
    expect(findOurRecipient(["boss@corp.com"], DOMAIN)).toBeNull();
  });
});

describe("sender + subject", () => {
  it("normalizes sender forms", () => {
    expect(normalizeSender("Priya S <Priya@Corp.com>")).toBe("priya@corp.com");
    expect(normalizeSender("  employee@acme.test ")).toBe("employee@acme.test");
  });
  it("subject → purpose strips Re/Fwd chains and caps length", () => {
    expect(subjectToPurpose("Fwd: Re: FW: Taxi to airport")).toBe("Taxi to airport");
    expect(subjectToPurpose("x".repeat(500)).length).toBe(200);
    expect(subjectToPurpose("  ")).toBe("");
  });
});

describe("Mailgun signature", () => {
  const KEY = "test-signing-key";
  const sign = (timestamp: string, token: string) =>
    createHmac("sha256", KEY).update(timestamp + token).digest("hex");

  it("accepts a valid, fresh signature", () => {
    const now = 1_700_000_000;
    const p = { timestamp: String(now), token: "tok123", signature: sign(String(now), "tok123") };
    expect(verifyMailgunSignature(p, KEY, now)).toBe(true);
  });
  it("rejects wrong signature, wrong key, and stale timestamps (replay)", () => {
    const now = 1_700_000_000;
    expect(
      verifyMailgunSignature(
        { timestamp: String(now), token: "tok", signature: "deadbeef" }, KEY, now)
    ).toBe(false);
    expect(
      verifyMailgunSignature(
        { timestamp: String(now), token: "tok", signature: sign(String(now), "tok") },
        "other-key", now)
    ).toBe(false);
    const old = String(now - 301);
    expect(
      verifyMailgunSignature(
        { timestamp: old, token: "tok", signature: sign(old, "tok") }, KEY, now)
    ).toBe(false);
  });
  it("rejects missing fields", () => {
    expect(verifyMailgunSignature({ timestamp: "", token: "", signature: "" }, KEY)).toBe(false);
  });
});

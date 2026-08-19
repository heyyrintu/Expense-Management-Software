import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  DEFAULT_COUNTRY_CODE,
  formatPhone,
  fromWaId,
  maskPhone,
  normalizePhone,
  toWaId,
} from "@/lib/whatsapp/phone";
import { computeSignature, verifySignature } from "@/lib/whatsapp/signature";
import {
  checkOtp,
  generateOtp,
  hashOtp,
  otpExpiry,
  otpMessage,
  OTP_MAX_ATTEMPTS,
} from "@/lib/whatsapp/otp";
import {
  configFromAccount,
  envConfig,
  whatsappConfigured,
  type AccountRow,
} from "@/lib/whatsapp/config";
import { buttonPayloadOf, parseInbound } from "@/lib/whatsapp/meta";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secret-box";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("phone normalization", () => {
  it("adds the default country code to a bare 10-digit number", () => {
    expect(normalizePhone("9876543210")).toEqual({
      ok: true,
      e164: "+919876543210",
      digits: "919876543210",
    });
  });

  it("drops the trunk prefix", () => {
    expect(normalizePhone("09876543210")).toMatchObject({ e164: "+919876543210" });
  });

  it("keeps an explicit country code and strips punctuation", () => {
    expect(normalizePhone("+91 98765 43210")).toMatchObject({ e164: "+919876543210" });
    expect(normalizePhone("+1 (415) 555-0132")).toMatchObject({ e164: "+14155550132" });
    expect(normalizePhone("0091 98765 43210")).toMatchObject({ e164: "+919876543210" });
  });

  it("does not re-add a country code to an already-prefixed number", () => {
    expect(normalizePhone("919876543210")).toMatchObject({ e164: "+919876543210" });
  });

  it("honours a different default country code", () => {
    expect(normalizePhone("4155550132", "1")).toMatchObject({ e164: "+14155550132" });
    expect(DEFAULT_COUNTRY_CODE).toBe("91");
  });

  it("rejects junk, empties and impossible lengths", () => {
    expect(normalizePhone("")).toMatchObject({ ok: false });
    expect(normalizePhone("   ")).toMatchObject({ ok: false });
    expect(normalizePhone("abc")).toMatchObject({ ok: false });
    expect(normalizePhone("12345")).toMatchObject({ ok: false });
    expect(normalizePhone("+1234567890123456")).toMatchObject({ ok: false });
    expect(normalizePhone("+0123456789")).toMatchObject({ ok: false });
  });

  it("round-trips Meta's wa_id form", () => {
    expect(fromWaId("919876543210")).toBe("+919876543210");
    expect(toWaId("+919876543210")).toBe("919876543210");
    expect(fromWaId("")).toBe("");
  });

  it("formats and masks for display", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+14155550132")).toBe("+14155550132");
    expect(maskPhone("+919876543210")).toBe("••••••3210");
    expect(maskPhone("+1")).toBe("••••");
  });
});

describe("webhook signature verification", () => {
  const secret = "app-secret-value";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("accepts a correctly signed body", () => {
    const sig = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
    expect(computeSignature(body, secret)).toBe(sig);
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = computeSignature(body, secret);
    expect(verifySignature(body + " ", sig, secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifySignature(body, computeSignature(body, "other"), secret)).toBe(false);
  });

  it("rejects missing, malformed, and wrong-length headers", () => {
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "", secret)).toBe(false);
    expect(verifySignature(body, "sha1=abc", secret)).toBe(false);
    expect(verifySignature(body, "sha256=short", secret)).toBe(false);
    expect(verifySignature(body, computeSignature(body, secret).toUpperCase(), secret)).toBe(
      false
    );
  });

  it("rejects everything when no secret is configured", () => {
    expect(verifySignature(body, computeSignature(body, secret), "")).toBe(false);
  });
});

describe("OTP flow", () => {
  const code = "123456";
  const state = {
    otpHash: hashOtp(code),
    otpExpiresAt: new Date("2026-08-21T10:10:00Z"),
    otpAttempts: 0,
  };
  const before = new Date("2026-08-21T10:05:00Z");

  it("generates a 6-digit code and never stores it in the clear", () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      expect(hashOtp(otp)).not.toContain(otp);
      expect(hashOtp(otp)).toHaveLength(64);
    }
  });

  it("accepts the right code before expiry, ignoring surrounding spaces", () => {
    expect(checkOtp(state, code, before)).toEqual({ ok: true });
    expect(checkOtp(state, " 123456 ", before)).toEqual({ ok: true });
  });

  it("rejects the wrong code and counts down attempts", () => {
    const res = checkOtp(state, "000000", before);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.attemptsLeft).toBe(OTP_MAX_ATTEMPTS - 1);
      expect(res.exhausted).toBe(false);
    }
  });

  it("rejects an expired code even when it matches", () => {
    const res = checkOtp(state, code, new Date("2026-08-21T10:11:00Z"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("expired");
  });

  it("locks out after the attempt ceiling", () => {
    const res = checkOtp({ ...state, otpAttempts: OTP_MAX_ATTEMPTS }, code, before);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.exhausted).toBe(true);
      expect(res.attemptsLeft).toBe(0);
    }
  });

  it("requires a fresh code when none was issued", () => {
    const res = checkOtp(
      { otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
      code,
      before
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.exhausted).toBe(true);
  });

  it("rejects non-numeric and wrong-length input", () => {
    expect(checkOtp(state, "12345", before).ok).toBe(false);
    expect(checkOtp(state, "abcdef", before).ok).toBe(false);
    expect(checkOtp(state, "1234567", before).ok).toBe(false);
  });

  it("expires ten minutes out and puts the code in the message", () => {
    const now = new Date("2026-08-21T10:00:00Z");
    expect(otpExpiry(now).toISOString()).toBe("2026-08-21T10:10:00.000Z");
    expect(otpMessage("123456", "Acme")).toContain("123456");
    expect(otpMessage("123456", "Acme")).toContain("Acme");
  });
});

describe("credential encryption", () => {
  it("round-trips a secret", () => {
    const cipher = encryptSecret("EAAG-super-secret-token", Buffer.from(KEY, "base64"));
    expect(cipher.startsWith("v1.")).toBe(true);
    expect(cipher).not.toContain("super-secret");
    expect(decryptSecret(cipher, Buffer.from(KEY, "base64"))).toBe(
      "EAAG-super-secret-token"
    );
  });

  it("uses a fresh IV each time", () => {
    const key = Buffer.from(KEY, "base64");
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  it("fails closed on tampering or the wrong key", () => {
    const key = Buffer.from(KEY, "base64");
    const cipher = encryptSecret("value", key);
    const parts = cipher.split(".");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("evil").toString("base64")].join(".");
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(cipher, Buffer.alloc(32, 9))).toThrow();
    expect(() => decryptSecret("garbage", key)).toThrow();
  });

  it("masks to the last four characters", () => {
    expect(maskSecret("abcdefgh")).toBe("••••efgh");
    expect(maskSecret(null)).toBe("—");
  });
});

describe("config gating", () => {
  const fullEnv = {
    WA_PHONE_NUMBER_ID: "1111",
    WA_TOKEN: "tok",
    WA_VERIFY_TOKEN: "verify",
    WA_APP_SECRET: "secret",
  } as unknown as NodeJS.ProcessEnv;

  it("is absent unless every variable is set", () => {
    expect(envConfig({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(whatsappConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      envConfig({ WA_PHONE_NUMBER_ID: "1", WA_TOKEN: "t" } as unknown as NodeJS.ProcessEnv)
    ).toBeNull();
    expect(whatsappConfigured(fullEnv)).toBe(true);
  });

  it("returns null for a disabled org even with full env", () => {
    const account: AccountRow = {
      orgId: "o1",
      enabled: false,
      phoneNumberId: "2222",
      businessPhone: "+911234567890",
      tokenCipher: null,
      appSecretCipher: null,
      verifyTokenCipher: null,
    };
    expect(configFromAccount(account, fullEnv)).toBeNull();
  });

  it("falls back to env for credentials the org has not supplied", () => {
    const account: AccountRow = {
      orgId: "o1",
      enabled: true,
      phoneNumberId: "2222",
      businessPhone: "+911234567890",
      tokenCipher: null,
      appSecretCipher: null,
      verifyTokenCipher: null,
    };
    const config = configFromAccount(account, fullEnv);
    expect(config).toMatchObject({ phoneNumberId: "2222", token: "tok", appSecret: "secret" });
  });

  it("is null when nothing is configured anywhere", () => {
    const account: AccountRow = {
      orgId: "o1",
      enabled: true,
      phoneNumberId: "2222",
      businessPhone: "+911234567890",
      tokenCipher: null,
      appSecretCipher: null,
      verifyTokenCipher: null,
    };
    expect(configFromAccount(account, {} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(configFromAccount(null, {} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("inbound payload parsing", () => {
  const envelope = (messages: unknown[]) => ({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "PN1", display_phone_number: "+911234567890" },
              messages,
            },
          },
        ],
      },
    ],
  });

  it("flattens text messages with the business number that received them", () => {
    const [msg] = parseInbound(
      envelope([
        { id: "wamid.1", from: "919876543210", timestamp: "1755772800", type: "text", text: { body: "lunch 450" } },
      ])
    );
    expect(msg).toMatchObject({
      waMessageId: "wamid.1",
      phoneNumberId: "PN1",
      from: "+919876543210",
      type: "text",
      text: "lunch 450",
      mediaId: null,
    });
    expect(msg.receivedAt.toISOString()).toBe("2025-08-21T10:40:00.000Z");
  });

  it("picks up image and document media ids with captions", () => {
    const msgs = parseInbound(
      envelope([
        { id: "wamid.2", from: "919876543210", type: "image", image: { id: "media-1", caption: "cab" } },
        { id: "wamid.3", from: "919876543210", type: "document", document: { id: "media-2", filename: "bill.pdf" } },
      ])
    );
    expect(msgs[0]).toMatchObject({ mediaId: "media-1", text: "cab" });
    expect(msgs[1]).toMatchObject({ mediaId: "media-2", text: null });
  });

  it("reads quick-reply payloads for 8.3", () => {
    const [msg] = parseInbound(
      envelope([
        {
          id: "wamid.4",
          from: "919876543210",
          type: "interactive",
          interactive: { button_reply: { id: "approve:report-1", title: "Approve" } },
        },
      ])
    );
    expect(msg.text).toBe("Approve");
    expect(buttonPayloadOf(msg)).toBe("approve:report-1");
  });

  it("tolerates junk, statuses-only payloads and missing metadata", () => {
    expect(parseInbound(null)).toEqual([]);
    expect(parseInbound({})).toEqual([]);
    expect(parseInbound({ entry: [{ changes: [{ value: { statuses: [] } }] }] })).toEqual([]);
    expect(parseInbound(envelope([{ from: "919876543210", type: "text" }]))).toEqual([]);
  });
});

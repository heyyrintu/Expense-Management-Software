// Config resolution — pure, no database import, so it is unit-testable and
// safe to import from anywhere.
//
// The whole feature is gated here: no config anywhere means the UI hides
// itself and every send is a no-op. The app runs normally without WhatsApp.
//
// Resolution order, per org:
//   1. the org's WhatsAppAccount row (credentials encrypted at rest)
//   2. process env (WA_PHONE_NUMBER_ID / WA_TOKEN / WA_VERIFY_TOKEN /
//      WA_APP_SECRET) — single-tenant or local development
import { tryDecryptSecret } from "@/lib/crypto/secret-box";
import { MetaCloudProvider } from "./meta";
import type { WhatsAppConfig, WhatsAppProvider } from "./types";

export type AccountRow = {
  orgId: string;
  enabled: boolean;
  phoneNumberId: string;
  businessPhone: string;
  tokenCipher: string | null;
  appSecretCipher: string | null;
  verifyTokenCipher: string | null;
};

/** Env fallback — present only when every required variable is set. */
export function envConfig(env = process.env): WhatsAppConfig | null {
  const phoneNumberId = env.WA_PHONE_NUMBER_ID;
  const token = env.WA_TOKEN;
  const verifyToken = env.WA_VERIFY_TOKEN;
  const appSecret = env.WA_APP_SECRET;
  if (!phoneNumberId || !token || !verifyToken || !appSecret) return null;
  return {
    phoneNumberId,
    token,
    verifyToken,
    appSecret,
    businessPhone: env.WA_BUSINESS_PHONE,
  };
}

/** True when WhatsApp could work at all on this deployment. */
export function whatsappConfigured(env = process.env): boolean {
  return envConfig(env) !== null;
}

/**
 * Merge a stored account row over the env defaults. Any credential the org
 * has not supplied falls back to env, which is what makes a single shared
 * business number work in development.
 */
export function configFromAccount(
  account: AccountRow | null,
  env = process.env
): WhatsAppConfig | null {
  const fallback = envConfig(env);
  if (!account) return fallback;
  if (!account.enabled) return null;

  const token = tryDecryptSecret(account.tokenCipher) ?? fallback?.token;
  const appSecret = tryDecryptSecret(account.appSecretCipher) ?? fallback?.appSecret;
  const verifyToken =
    tryDecryptSecret(account.verifyTokenCipher) ?? fallback?.verifyToken;
  const phoneNumberId = account.phoneNumberId || fallback?.phoneNumberId;
  if (!phoneNumberId || !token || !appSecret || !verifyToken) return null;
  return {
    phoneNumberId,
    token,
    appSecret,
    verifyToken,
    businessPhone: account.businessPhone || fallback?.businessPhone,
  };
}

/** Swap this one line to change providers (Twilio, a test double, …). */
export function providerFor(config: WhatsAppConfig): WhatsAppProvider {
  return new MetaCloudProvider(config);
}

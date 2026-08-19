// WhatsApp channel entry point (8.1) — the database-touching half.
// Pure config/gating lives in ./config so it can be imported anywhere.
import { prisma } from "@/lib/db/client";
import {
  configFromAccount,
  envConfig,
  providerFor,
  type AccountRow,
} from "./config";
import type { WhatsAppConfig, WhatsAppProvider } from "./types";

export {
  configFromAccount,
  envConfig,
  providerFor,
  whatsappConfigured,
  type AccountRow,
} from "./config";
export type { WhatsAppConfig, WhatsAppProvider, InboundMessage } from "./types";

/**
 * Resolve the provider for an org. Reads the account row directly because a
 * webhook has no session yet; the row carries no tenant data beyond the org's
 * own credentials, and every subsequent write goes through scopedDb.
 */
export async function providerForOrg(
  orgId: string
): Promise<{ provider: WhatsAppProvider; config: WhatsAppConfig } | null> {
  const account = (await prisma.whatsAppAccount.findUnique({
    where: { orgId },
  })) as AccountRow | null;
  const config = configFromAccount(account);
  if (!config) return null;
  return { provider: providerFor(config), config };
}

/**
 * Inbound routing: the BUSINESS number decides the org. The same personal
 * number may be linked in several orgs, so this must never key on the sender.
 */
export async function orgForPhoneNumberId(
  phoneNumberId: string
): Promise<{ orgId: string; provider: WhatsAppProvider; config: WhatsAppConfig } | null> {
  const account = (await prisma.whatsAppAccount.findUnique({
    where: { phoneNumberId },
  })) as AccountRow | null;

  if (!account) {
    // Single-number development setup: fall back to env, but only when the id
    // actually matches the configured business number.
    const env = envConfig();
    if (!env || env.phoneNumberId !== phoneNumberId) return null;
    const soleOrg = await prisma.organization.findFirst({
      where: { status: "active" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!soleOrg) return null;
    return { orgId: soleOrg.id, provider: providerFor(env), config: env };
  }

  const config = configFromAccount(account);
  if (!config) return null;
  return { orgId: account.orgId, provider: providerFor(config), config };
}

/** Is WhatsApp usable for this org right now? Used to hide the UI. */
export async function whatsappEnabledFor(orgId: string): Promise<boolean> {
  const account = (await prisma.whatsAppAccount.findUnique({
    where: { orgId },
  })) as AccountRow | null;
  return configFromAccount(account) !== null;
}

/** Fire-and-forget send; never throws into a workflow. */
export async function sendWhatsAppText(
  orgId: string,
  to: string,
  body: string
): Promise<boolean> {
  try {
    const resolved = await providerForOrg(orgId);
    if (!resolved) return false;
    const res = await resolved.provider.sendText(to, body);
    return res.ok;
  } catch (e) {
    console.error("[whatsapp] sendText failed:", e);
    return false;
  }
}

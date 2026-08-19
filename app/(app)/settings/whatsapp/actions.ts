"use server";

// WhatsApp channel settings (8.1) — org_admin only.
//
// Credentials are encrypted with AES-256-GCM before they touch the database
// (lib/crypto/secret-box.ts) and are never returned to the browser: the form
// shows a masked hint and a blank field means "leave unchanged".
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { encryptSecret, hasEncryptionKey } from "@/lib/crypto/secret-box";
import { scopedDb } from "@/lib/db/scoped";
import { logAudit } from "@/lib/domain/audit";
import { err, ok, userErrors, type Result } from "@/lib/errors";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { z } from "zod";

const settingsSchema = z.object({
  enabled: z.boolean(),
  phoneNumberId: z.string().trim().regex(/^\d{5,32}$/, "Phone number ID is numeric."),
  businessPhone: z.string().trim().min(1, "Enter the business number."),
  token: z.string().trim().max(500).optional(),
  appSecret: z.string().trim().max(200).optional(),
  verifyToken: z.string().trim().max(200).optional(),
});

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

function optional(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

export async function saveWhatsAppSettingsAction(
  formData: FormData
): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = settingsSchema.safeParse({
      enabled: formData.get("enabled") === "on",
      phoneNumberId: String(formData.get("phoneNumberId") ?? ""),
      businessPhone: String(formData.get("businessPhone") ?? ""),
      token: optional(formData, "token"),
      appSecret: optional(formData, "appSecret"),
      verifyToken: optional(formData, "verifyToken"),
    });
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? userErrors.validation);
    }
    const input = parsed.data;

    const phone = normalizePhone(input.businessPhone);
    if (!phone.ok) return err(phone.error);

    if (!hasEncryptionKey() && (input.token || input.appSecret || input.verifyToken)) {
      return err(
        "APP_ENCRYPTION_KEY is not configured on the server, so credentials can't be stored securely."
      );
    }

    const db = scopedDb(ctx.orgId);
    const existing = (await db.whatsAppAccount.findUnique({
      where: { orgId: ctx.orgId },
      select: {
        id: true,
        tokenCipher: true,
        appSecretCipher: true,
        verifyTokenCipher: true,
      },
    })) as {
      id: string;
      tokenCipher: string | null;
      appSecretCipher: string | null;
      verifyTokenCipher: string | null;
    } | null;

    // Blank field = keep what is already stored.
    const tokenCipher = input.token
      ? encryptSecret(input.token)
      : (existing?.tokenCipher ?? null);
    const appSecretCipher = input.appSecret
      ? encryptSecret(input.appSecret)
      : (existing?.appSecretCipher ?? null);
    const verifyTokenCipher = input.verifyToken
      ? encryptSecret(input.verifyToken)
      : (existing?.verifyTokenCipher ?? null);

    const data = {
      enabled: input.enabled,
      phoneNumberId: input.phoneNumberId,
      businessPhone: phone.e164,
      tokenCipher,
      appSecretCipher,
      verifyTokenCipher,
    };

    try {
      await db.whatsAppAccount.upsert({
        where: { orgId: ctx.orgId },
        create: { orgId: ctx.orgId, ...data },
        update: data,
      });
    } catch (e) {
      // phone_number_id is globally unique — it routes inbound webhooks.
      if ((e as { code?: string }).code === "P2002") {
        return err("That WhatsApp phone number ID is already in use.");
      }
      throw e;
    }

    await logAudit(db, ctx, {
      entity: "WhatsAppAccount",
      entityId: ctx.orgId,
      action: "whatsapp.settings_updated",
      meta: {
        enabled: input.enabled,
        phoneNumberId: input.phoneNumberId,
        // which secrets were rotated — never the values
        rotated: {
          token: Boolean(input.token),
          appSecret: Boolean(input.appSecret),
          verifyToken: Boolean(input.verifyToken),
        },
      },
    });

    revalidatePath("/settings/whatsapp");
    revalidatePath("/profile");
    return ok(undefined);
  } catch (e) {
    return guardError(e) ?? err(userErrors.unknown);
  }
}

/** Turn the channel off without discarding the stored credentials. */
export async function disableWhatsAppAction(): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const db = scopedDb(ctx.orgId);
    const existing = await db.whatsAppAccount.findUnique({
      where: { orgId: ctx.orgId },
      select: { id: true },
    });
    if (!existing) return ok(undefined);

    await db.whatsAppAccount.update({
      where: { orgId: ctx.orgId },
      data: { enabled: false },
    });
    await logAudit(db, ctx, {
      entity: "WhatsAppAccount",
      entityId: ctx.orgId,
      action: "whatsapp.disabled",
    });
    revalidatePath("/settings/whatsapp");
    return ok(undefined);
  } catch (e) {
    return guardError(e) ?? err(userErrors.unknown);
  }
}

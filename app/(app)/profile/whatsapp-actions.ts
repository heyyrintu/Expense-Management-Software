"use server";

// WhatsApp number linking (8.1) — self-service, org-scoped.
//
// Flow: start (normalize + claim the number in this org + send OTP over
// WhatsApp) -> confirm (hashed-code check with expiry + attempt ceiling)
// -> unlink. The number is only usable once verifiedAt is set; the code is
// never stored in the clear and never written to AuditLog.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireSession,
} from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { logAudit } from "@/lib/domain/audit";
import { err, ok, userErrors, type Result } from "@/lib/errors";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { providerForOrg } from "@/lib/whatsapp";
import { maskPhone, normalizePhone } from "@/lib/whatsapp/phone";
import {
  checkOtp,
  generateOtp,
  hashOtp,
  otpExpiry,
  otpMessage,
} from "@/lib/whatsapp/otp";

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

type LinkRow = {
  id: string;
  phoneE164: string;
  verifiedAt: Date | null;
  otpHash: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
};

export async function startWhatsAppLinkAction(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = normalizePhone(String(formData.get("phone") ?? ""));
    if (!parsed.ok) return err(parsed.error);
    if (!checkRateLimit("whatsappOtp", `${ctx.orgId}:${ctx.userId}`)) {
      return err(rateLimitedMessage);
    }

    const resolved = await providerForOrg(ctx.orgId);
    if (!resolved) return err("WhatsApp isn't switched on for your organization.");

    const db = scopedDb(ctx.orgId);

    // A number belongs to at most one person per org (unique [orgId, phone]).
    const claimed = (await db.whatsAppLink.findFirst({
      where: { phoneE164: parsed.e164 },
      select: { id: true, userId: true },
    })) as { id: string; userId: string } | null;
    if (claimed && claimed.userId !== ctx.userId) {
      return err("That number is already linked to another account here.");
    }

    const code = generateOtp();
    const data = {
      phoneE164: parsed.e164,
      otpHash: hashOtp(code),
      otpExpiresAt: otpExpiry(),
      otpAttempts: 0,
      verifiedAt: null,
      optedOut: false,
    };
    await db.whatsAppLink.upsert({
      where: { userId: ctx.userId },
      create: { orgId: ctx.orgId, userId: ctx.userId, ...data },
      update: data,
    });

    const org = await db.organization.findUniqueOrThrow({
      where: { id: ctx.orgId },
      select: { name: true },
    });
    const sent = await resolved.provider.sendText(
      parsed.e164,
      otpMessage(code, org.name)
    );
    if (!sent.ok) {
      return err(
        "We couldn't send the code to that number. Check it and try again."
      );
    }

    await logAudit(db, ctx, {
      entity: "WhatsAppLink",
      entityId: ctx.userId,
      action: "whatsapp.link_started",
      meta: { phone: maskPhone(parsed.e164) }, // never the full number
    });

    revalidatePath("/profile");
    return ok(undefined);
  } catch (e) {
    return guardError(e) ?? err(userErrors.unknown);
  }
}

export async function confirmWhatsAppLinkAction(formData: FormData): Promise<Result> {
  try {
    const ctx = await requireSession();
    const db = scopedDb(ctx.orgId);
    const link = (await db.whatsAppLink.findUnique({
      where: { userId: ctx.userId },
      select: {
        id: true,
        phoneE164: true,
        verifiedAt: true,
        otpHash: true,
        otpExpiresAt: true,
        otpAttempts: true,
      },
    })) as LinkRow | null;
    if (!link) return err("Start by entering your number.");
    if (link.verifiedAt) return ok(undefined); // already done

    const result = checkOtp(link, String(formData.get("code") ?? ""));
    if (!result.ok) {
      // Count the attempt, and burn the code once the ceiling is hit.
      await db.whatsAppLink.update({
        where: { userId: ctx.userId },
        data: result.exhausted
          ? { otpAttempts: link.otpAttempts + 1, otpHash: null, otpExpiresAt: null }
          : { otpAttempts: link.otpAttempts + 1 },
      });
      return err(result.error);
    }

    await db.whatsAppLink.update({
      where: { userId: ctx.userId },
      data: {
        verifiedAt: new Date(),
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
    });
    await logAudit(db, ctx, {
      entity: "WhatsAppLink",
      entityId: ctx.userId,
      action: "whatsapp.linked",
      meta: { phone: maskPhone(link.phoneE164) },
    });

    revalidatePath("/profile");
    return ok(undefined);
  } catch (e) {
    return guardError(e) ?? err(userErrors.unknown);
  }
}

export async function unlinkWhatsAppAction(): Promise<Result> {
  try {
    const ctx = await requireSession();
    const db = scopedDb(ctx.orgId);
    const link = (await db.whatsAppLink.findUnique({
      where: { userId: ctx.userId },
      select: { phoneE164: true },
    })) as { phoneE164: string } | null;
    if (!link) return ok(undefined);

    await db.whatsAppLink.delete({ where: { userId: ctx.userId } });
    await logAudit(db, ctx, {
      entity: "WhatsAppLink",
      entityId: ctx.userId,
      action: "whatsapp.unlinked",
      meta: { phone: maskPhone(link.phoneE164) },
    });

    revalidatePath("/profile");
    return ok(undefined);
  } catch (e) {
    return guardError(e) ?? err(userErrors.unknown);
  }
}

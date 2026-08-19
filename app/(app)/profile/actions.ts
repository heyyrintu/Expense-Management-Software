"use server";

// Employee bank details (6.1) — self-service; account number never leaves
// the server unmasked and never lands in AuditLog meta.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireSession,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { z } from "zod";

const bankSchema = z.object({
  bankAccountName: z.string().trim().min(1, "Account holder name is required").max(80),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "Account number: 6–20 digits"),
  bankIfsc: z.union([
    z.literal(""),
    z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC like HDFC0001234"),
  ]),
  upiId: z.union([
    z.literal(""),
    z.string().trim().toLowerCase().regex(/^[\w.\-]{2,}@[a-z]{2,}$/, "UPI like name@bank"),
  ]),
});

export async function updateBankDetailsAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = bankSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? userErrors.validation);
    }

    const db = scopedDb(ctx.orgId);
    await db.user.update({
      where: { id: ctx.userId }, // self only
      data: {
        bankAccountName: parsed.data.bankAccountName,
        bankAccountNumber: parsed.data.bankAccountNumber,
        bankIfsc: parsed.data.bankIfsc || null,
        upiId: parsed.data.upiId || null,
      },
    });
    await logAudit(db, ctx, {
      entity: "User",
      entityId: ctx.userId,
      action: "user.bank_details_updated",
      meta: {}, // deliberately empty — no account data in the audit trail
    });
    revalidatePath("/profile");
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
      return err(e.message);
    }
    throw e;
  }
}

/**
 * Reveal the CALLER'S OWN account number (D4.4).
 *
 * ── WHY THIS IS SAFE, AND WHY IT IS NEEDED ────────────────────────────────
 * Take no argument. There is no `userId` parameter to tamper with, and there
 * never should be: the identity comes from the session, so this action
 * structurally cannot be aimed at somebody else's row. `scopedDb` pins the
 * org on top of that.
 *
 * It is needed because "masked forever" means an employee can never check
 * the number finance will pay into — and a wrong digit there is exactly the
 * dispute the complaints screen exists to handle. Being able to verify your
 * own bank details is not a privilege escalation.
 *
 * What does NOT change: finance's view of somebody else's bank details stays
 * presence-only (a boolean, never a digit) on the payment run, and the number
 * is still never written to AuditLog.
 */
export async function revealOwnAccountNumberAction(): Promise<string | null> {
  try {
    const ctx = await requireSession();
    const user = (await scopedDb(ctx.orgId).user.findUnique({
      where: { id: ctx.userId },
      select: { bankAccountNumber: true },
    })) as { bankAccountNumber: string | null } | null;
    return user?.bankAccountNumber ?? null;
  } catch (e) {
    if (e instanceof AuthenticationError || e instanceof AuthorizationError) return null;
    throw e;
  }
}

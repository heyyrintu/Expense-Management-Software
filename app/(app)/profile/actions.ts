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

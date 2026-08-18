"use server";

// Manual reconciliation for the unmatched worklist (5.2).
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { z } from "zod";

const matchSchema = z.object({
  transactionId: z.string().uuid(),
  expenseId: z.string().uuid(),
});
const txnSchema = z.object({ transactionId: z.string().uuid() });

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

function isPrismaCode(e: unknown, code: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === code
  );
}

export async function matchTransactionAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = matchSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    // both sides must resolve inside this org
    const expense = await db.expense.findUnique({
      where: { id: parsed.data.expenseId },
      select: { id: true },
    });
    if (!expense) return err("Pick a valid expense.");

    const res = await db.cardTransaction.updateMany({
      where: { id: parsed.data.transactionId, matchedExpenseId: null },
      data: { matchedExpenseId: expense.id },
    });
    if (res.count === 0) return err("That transaction is already matched.");

    await logAudit(db, ctx, {
      entity: "CardTransaction",
      entityId: parsed.data.transactionId,
      action: "card.matched",
      meta: { expenseId: expense.id },
    });
    revalidatePath("/card-imports");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2002"))
      return err("That expense is already matched to another transaction.");
    throw e;
  }
}

export async function unmatchTransactionAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = txnSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.cardTransaction.updateMany({
      where: { id: parsed.data.transactionId, matchedExpenseId: { not: null } },
      data: { matchedExpenseId: null },
    });
    if (res.count === 0) return err("That transaction isn't matched.");

    await logAudit(db, ctx, {
      entity: "CardTransaction",
      entityId: parsed.data.transactionId,
      action: "card.unmatched",
    });
    revalidatePath("/card-imports");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

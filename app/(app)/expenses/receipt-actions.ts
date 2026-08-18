"use server";

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
import { deleteReceiptObject } from "@/lib/storage/receipts";

const deleteSchema = z.object({ receiptId: z.string().uuid() });

export async function deleteReceiptAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    // receipt must hang off the session user's own DRAFT expense
    const receipt = await db.receipt.findUnique({
      where: { id: parsed.data.receiptId },
      include: { expense: { select: { id: true, userId: true, status: true } } },
    });
    if (
      !receipt ||
      receipt.expense.userId !== ctx.userId ||
      receipt.expense.status !== "draft"
    ) {
      return err("Receipts can only be removed from your draft expenses.");
    }

    await db.receipt.delete({ where: { id: receipt.id } });
    await deleteReceiptObject(receipt.storageKey);
    await logAudit(db, ctx, {
      entity: "Receipt",
      entityId: receipt.id,
      action: "receipt.deleted",
      meta: { expenseId: receipt.expense.id },
    });
    revalidatePath(`/expenses/${receipt.expense.id}`);
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
      return err(e.message);
    }
    throw e;
  }
}

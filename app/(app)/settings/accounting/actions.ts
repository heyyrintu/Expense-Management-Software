"use server";

// Account-mapping CRUD (FINAL-AUDIT §4). finance_admin — a mapping decides
// which ledger a cost lands in.
import { revalidatePath } from "next/cache";

import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { logAudit } from "@/lib/domain/audit";
import { err, ok, userErrors, type Result } from "@/lib/errors";
import { mappingIdSchema, mappingInputSchema } from "@/lib/schemas/accounting";

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

const DUPLICATE =
  "That record is already mapped for this system. Edit the existing row instead.";

export async function saveMappingAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = mappingInputSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const { target, entityType, localId, remoteCode, remoteName } = parsed.data;

    const db = scopedDb(ctx.orgId);
    // Upsert on the natural key: the settings screen edits in place, and
    // making the reader delete-then-add to change a code would be a worse
    // version of the same operation.
    const existing = (await db.accountingMapping.findFirst({
      where: { target, entityType, localId },
      select: { id: true },
    })) as { id: string } | null;

    if (existing) {
      await db.accountingMapping.updateMany({
        where: { id: existing.id },
        data: { remoteCode, remoteName: remoteName === "" ? null : remoteName },
      });
    } else {
      await db.accountingMapping.create({
        data: {
          orgId: ctx.orgId,
          target,
          entityType,
          localId,
          remoteCode,
          remoteName: remoteName === "" ? null : remoteName,
        },
      });
    }

    await logAudit(db, ctx, {
      entity: "AccountingMapping",
      entityId: existing?.id ?? localId,
      action: existing ? "accounting_mapping.updated" : "accounting_mapping.created",
      meta: { target, entityType, localId, remoteCode },
    });
    revalidatePath("/settings/accounting");
    return ok(undefined);
  } catch (e) {
    if (isPrismaCode(e, "P2002")) return err(DUPLICATE);
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function deleteMappingAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = mappingIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.accountingMapping.deleteMany({ where: { id: parsed.data.id } });
    if (res.count === 0) return err("That mapping no longer exists.");

    await logAudit(db, ctx, {
      entity: "AccountingMapping",
      entityId: parsed.data.id,
      action: "accounting_mapping.deleted",
      meta: {},
    });
    revalidatePath("/settings/accounting");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

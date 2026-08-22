"use server";

// Per-diem rate CRUD (PRD P1). finance_admin only — these set what the
// organisation pays, so the guard is the same one the categories screen uses.
//
// Rates are VERSIONED, not edited in place: see the doc comment on
// PerDiemRate in schema.prisma. Editing a row here changes what an existing
// expense would be re-priced at only if that expense is still a draft and
// gets re-saved — approved expenses keep the amount they were approved at,
// because `Expense.perDiemRateId` pins the row and the amount is stored.
import { revalidatePath } from "next/cache";

import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { logAudit } from "@/lib/domain/audit";
import { err, ok, userErrors, type Result } from "@/lib/errors";
import { parseToMinorUnits } from "@/lib/money";
import {
  perDiemRateIdSchema,
  perDiemRateInputSchema,
} from "@/lib/schemas/expense";

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
  "A rate with that name already starts on that date — pick a different effective date.";
/** P2003 is a foreign-key violation: the RESTRICT on expenses.per_diem_rate_id. */
const IN_USE =
  "This rate has already priced an expense, so it can't be deleted. Mark it inactive instead — expenses keep the rate they were filed at.";

export async function createPerDiemRateAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = perDiemRateInputSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const dailyAmount = parseToMinorUnits(parsed.data.dailyAmount);
    if (dailyAmount === null || dailyAmount <= 0) {
      return err("Enter a daily amount above zero.");
    }

    const db = scopedDb(ctx.orgId);
    const rate = await db.perDiemRate.create({
      data: {
        orgId: ctx.orgId,
        name: parsed.data.name,
        location: parsed.data.location === "" ? null : parsed.data.location,
        dailyAmount,
        effectiveFrom: new Date(`${parsed.data.effectiveFrom}T00:00:00.000Z`),
        active: parsed.data.active,
      },
    });

    await logAudit(db, ctx, {
      entity: "PerDiemRate",
      entityId: rate.id,
      action: "per_diem_rate.created",
      meta: {
        name: parsed.data.name,
        dailyAmount,
        effectiveFrom: parsed.data.effectiveFrom,
      },
    });
    revalidatePath("/settings/per-diem");
    return ok(undefined);
  } catch (e) {
    if (isPrismaCode(e, "P2002")) return err(DUPLICATE);
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function updatePerDiemRateAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = perDiemRateIdSchema
      .merge(perDiemRateInputSchema)
      .safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const dailyAmount = parseToMinorUnits(parsed.data.dailyAmount);
    if (dailyAmount === null || dailyAmount <= 0) {
      return err("Enter a daily amount above zero.");
    }

    const db = scopedDb(ctx.orgId);
    // updateMany, not update: scopedDb injects org_id into the where clause,
    // so a rate id from another tenant matches nothing instead of throwing a
    // not-found that would confirm the row exists.
    const res = await db.perDiemRate.updateMany({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        location: parsed.data.location === "" ? null : parsed.data.location,
        dailyAmount,
        effectiveFrom: new Date(`${parsed.data.effectiveFrom}T00:00:00.000Z`),
        active: parsed.data.active,
      },
    });
    if (res.count === 0) return err("That per-diem rate no longer exists.");

    await logAudit(db, ctx, {
      entity: "PerDiemRate",
      entityId: parsed.data.id,
      action: "per_diem_rate.updated",
      meta: { name: parsed.data.name, dailyAmount, active: parsed.data.active },
    });
    revalidatePath("/settings/per-diem");
    return ok(undefined);
  } catch (e) {
    if (isPrismaCode(e, "P2002")) return err(DUPLICATE);
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function deletePerDiemRateAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = perDiemRateIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.perDiemRate.deleteMany({ where: { id: parsed.data.id } });
    if (res.count === 0) return err("That per-diem rate no longer exists.");

    await logAudit(db, ctx, {
      entity: "PerDiemRate",
      entityId: parsed.data.id,
      action: "per_diem_rate.deleted",
      meta: {},
    });
    revalidatePath("/settings/per-diem");
    return ok(undefined);
  } catch (e) {
    // The FK is RESTRICT on purpose — losing the link would leave an amount
    // nobody can re-derive. Say so, and point at the action that works.
    if (isPrismaCode(e, "P2003")) return err(IN_USE);
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

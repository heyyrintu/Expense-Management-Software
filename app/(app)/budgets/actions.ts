"use server";

// Budget CRUD (5.1) — finance_admin+. scope_id is validated against the
// SAME org scope, so a cross-org department/project/category id can never
// be budgeted.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb, type ScopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { parseToMinorUnits } from "@/lib/money";
import {
  budgetAmountSchema,
  budgetIdSchema,
  budgetInputSchema,
} from "@/lib/schemas/budget";

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

async function scopeExists(
  db: ScopedDb,
  scopeType: "department" | "project" | "category",
  scopeId: string
): Promise<boolean> {
  if (scopeType === "department") {
    return (await db.department.findUnique({ where: { id: scopeId } })) !== null;
  }
  if (scopeType === "project") {
    return (await db.project.findUnique({ where: { id: scopeId } })) !== null;
  }
  return (await db.category.findUnique({ where: { id: scopeId } })) !== null;
}

export async function createBudgetAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = budgetInputSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const amount = parseToMinorUnits(parsed.data.amount);
    if (amount === null || amount === 0) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    if (!(await scopeExists(db, parsed.data.scopeType, parsed.data.scopeId))) {
      return err("Pick a valid target in your organization.");
    }

    const budget = await db.budget.create({
      data: {
        orgId: ctx.orgId,
        scopeType: parsed.data.scopeType,
        scopeId: parsed.data.scopeId,
        period: parsed.data.period,
        amount,
      },
    });
    await logAudit(db, ctx, {
      entity: "Budget",
      entityId: budget.id,
      action: "budget.created",
      meta: { ...parsed.data, amount },
    });
    revalidatePath("/budgets");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2002"))
      return err("A budget for that target and period already exists.");
    throw e;
  }
}

export async function updateBudgetAmountAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = budgetAmountSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const amount = parseToMinorUnits(parsed.data.amount);
    if (amount === null || amount === 0) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.budget.updateMany({
      where: { id: parsed.data.id },
      data: { amount },
    });
    if (res.count === 0) return err("Budget not found.");

    await logAudit(db, ctx, {
      entity: "Budget",
      entityId: parsed.data.id,
      action: "budget.updated",
      meta: { amount },
    });
    revalidatePath("/budgets");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function deleteBudgetAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = budgetIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.budget.deleteMany({ where: { id: parsed.data.id } });
    if (res.count === 0) return err("Budget not found.");

    await logAudit(db, ctx, {
      entity: "Budget",
      entityId: parsed.data.id,
      action: "budget.deleted",
    });
    revalidatePath("/budgets");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

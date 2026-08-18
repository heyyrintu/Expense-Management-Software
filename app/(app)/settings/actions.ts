"use server";

// Category CRUD + org settings — finance_admin and above only.
// Every mutation: requireRole → Zod → scopedDb → AuditLog → revalidate.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { parseToMinorUnits } from "@/lib/money";
import {
  categoryIdSchema,
  categoryInputSchema,
  type CategoryInput,
} from "@/lib/schemas/category";
import { orgSettingsSchema } from "@/lib/schemas/org-settings";

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

function moneyOrNull(v: string): number | null {
  return v === "" ? null : parseToMinorUnits(v);
}

function categoryData(input: CategoryInput) {
  return {
    name: input.name,
    perExpenseLimit: moneyOrNull(input.perExpenseLimit),
    monthlyLimit: moneyOrNull(input.monthlyLimit),
    receiptRequiredAbove: moneyOrNull(input.receiptRequiredAbove),
  };
}

export async function createCategoryAction(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const category = await db.category.create({
      // orgId stamped by scopedDb regardless; explicit for the generated types
      data: { orgId: ctx.orgId, ...categoryData(parsed.data) },
    });
    await logAudit(db, ctx, {
      entity: "Category",
      entityId: category.id,
      action: "category.created",
      meta: { name: parsed.data.name },
    });
    revalidatePath("/settings/categories");
    return ok({ id: category.id });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ id: string }>;
    if (isPrismaCode(e, "P2002")) return err("A category with that name already exists.");
    throw e;
  }
}

export async function updateCategoryAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = categoryIdSchema.merge(categoryInputSchema).safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const { id, ...rest } = parsed.data;

    const db = scopedDb(ctx.orgId);
    await db.category.update({ where: { id }, data: categoryData(rest) });
    await logAudit(db, ctx, {
      entity: "Category",
      entityId: id,
      action: "category.updated",
      meta: { name: rest.name },
    });
    revalidatePath("/settings/categories");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2025")) return err("Category not found.");
    if (isPrismaCode(e, "P2002")) return err("A category with that name already exists.");
    throw e;
  }
}

export async function deleteCategoryAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = categoryIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    await db.category.delete({ where: { id: parsed.data.id } });
    await logAudit(db, ctx, {
      entity: "Category",
      entityId: parsed.data.id,
      action: "category.deleted",
    });
    revalidatePath("/settings/categories");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2025")) return err("Category not found.");
    if (isPrismaCode(e, "P2003"))
      return err("This category has expenses and can't be deleted.");
    throw e;
  }
}

export async function updateOrgSettingsAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = orgSettingsSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const mileageRate = parseToMinorUnits(parsed.data.mileageRate);
    if (mileageRate === null) return err(userErrors.validation);
    const secondApprovalAbove =
      parsed.data.secondApprovalAbove === ""
        ? null
        : parseToMinorUnits(parsed.data.secondApprovalAbove);

    const db = scopedDb(ctx.orgId);
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    const settings = {
      ...((org.settings as Record<string, unknown>) ?? {}),
      secondApprovalAbove,
    };
    await db.organization.update({
      where: { id: ctx.orgId },
      data: {
        name: parsed.data.name,
        currency: parsed.data.currency,
        mileageRate,
        settings,
      },
    });
    await logAudit(db, ctx, {
      entity: "Organization",
      entityId: ctx.orgId,
      action: "org.settings_updated",
      meta: { currency: parsed.data.currency, mileageRate, secondApprovalAbove },
    });
    revalidatePath("/settings/organization");
    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

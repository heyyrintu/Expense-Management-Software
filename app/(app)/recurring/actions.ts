"use server";

// Recurring-template CRUD (6.5) — own templates only.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
  requireSession,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { parseToMinorUnits } from "@/lib/money";
import { moneyString } from "@/lib/schemas/category";
import { z } from "zod";

const templateSchema = z
  .object({
    cadence: z.enum(["monthly", "weekly"]),
    day: z.coerce.number().int(),
    amount: moneyString,
    categoryId: z.string().uuid("Pick a category"),
    merchant: z.string().trim().min(1, "Merchant is required").max(80),
    purpose: z.string().trim().max(200),
  })
  .refine(
    (d) => (d.cadence === "monthly" ? d.day >= 1 && d.day <= 28 : d.day >= 1 && d.day <= 7),
    { message: "Monthly: day 1–28. Weekly: 1 (Mon) – 7 (Sun).", path: ["day"] }
  );
const idSchema = z.object({ id: z.string().uuid() });

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

export async function createTemplateAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = templateSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? userErrors.validation);
    }
    const amount = parseToMinorUnits(parsed.data.amount);
    if (amount === null || amount === 0) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const category = await db.category.findUnique({
      where: { id: parsed.data.categoryId },
    });
    if (!category) return err("Pick a valid category.");

    const tpl = await db.recurringTemplate.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        cadence: parsed.data.cadence,
        day: parsed.data.day,
        amount,
        categoryId: parsed.data.categoryId,
        merchant: parsed.data.merchant,
        purpose: parsed.data.purpose,
      },
    });
    await logAudit(db, ctx, {
      entity: "RecurringTemplate",
      entityId: tpl.id,
      action: "recurring.created",
      meta: { cadence: parsed.data.cadence, day: parsed.data.day, amount },
    });
    revalidatePath("/recurring");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function toggleTemplateAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const db = scopedDb(ctx.orgId);
    const tpl = await db.recurringTemplate.findUnique({
      where: { id: parsed.data.id, userId: ctx.userId },
    });
    if (!tpl) return err("Template not found.");
    await db.recurringTemplate.update({
      where: { id: tpl.id },
      data: { active: !tpl.active },
    });
    await logAudit(db, ctx, {
      entity: "RecurringTemplate",
      entityId: tpl.id,
      action: tpl.active ? "recurring.paused" : "recurring.resumed",
    });
    revalidatePath("/recurring");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function deleteTemplateAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const db = scopedDb(ctx.orgId);
    const res = await db.recurringTemplate.deleteMany({
      where: { id: parsed.data.id, userId: ctx.userId },
    });
    if (res.count === 0) return err("Template not found.");
    await logAudit(db, ctx, {
      entity: "RecurringTemplate",
      entityId: parsed.data.id,
      action: "recurring.deleted",
    });
    revalidatePath("/recurring");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

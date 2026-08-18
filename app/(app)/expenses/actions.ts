"use server";

// Draft expense CRUD. Ownership model: an expense belongs to its creator —
// every where clause pins BOTH the session user and draft status, on top of
// scopedDb's org scoping. orgId/userId always come from the session.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { toExpenseData, toMileageData } from "@/lib/domain/expense";
import { computeExpenseFlags } from "@/lib/domain/policy-eval";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import {
  expenseIdSchema,
  expenseInputSchema,
  mileageInputSchema,
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

const NOT_EDITABLE = "Only draft expenses can be changed.";

export async function createExpenseAction(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireRole("employee");
    const parsed = expenseInputSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const data = toExpenseData(parsed.data);
    if (!data) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    // category (and project, if set) must exist in this org — scopedDb turns
    // cross-org ids into not-found
    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return err("Pick a valid category.");
    if (data.projectId) {
      const project = await db.project.findUnique({ where: { id: data.projectId } });
      if (!project) return err("Pick a valid project.");
    }
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });

    // policy check runs inline at entry time — flags, never blocks (PRD 6.5)
    const flags = await computeExpenseFlags(db, ctx.orgId, {
      expenseId: null,
      userId: ctx.userId,
      amount: data.amount,
      date: data.date,
      merchant: data.merchant,
      categoryId: data.categoryId,
      receiptCount: 0,
    });

    const expense = await db.expense.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        currency: org.currency,
        ...data,
        flags,
      },
    });
    await logAudit(db, ctx, {
      entity: "Expense",
      entityId: expense.id,
      action: "expense.created",
      meta: { amount: data.amount, merchant: data.merchant, flagCount: flags.length },
    });
    revalidatePath("/expenses");
    return ok({ id: expense.id });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ id: string }>;
    throw e;
  }
}

export async function updateExpenseAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = expenseIdSchema.merge(expenseInputSchema).safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const { id, ...rest } = parsed.data;
    const data = toExpenseData(rest);
    if (!data) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return err("Pick a valid category.");
    if (data.projectId) {
      const project = await db.project.findUnique({ where: { id: data.projectId } });
      if (!project) return err("Pick a valid project.");
    }

    const receiptCount = await db.receipt.count({ where: { expenseId: id } });
    const flags = await computeExpenseFlags(db, ctx.orgId, {
      expenseId: id,
      userId: ctx.userId,
      amount: data.amount,
      date: data.date,
      merchant: data.merchant,
      categoryId: data.categoryId,
      receiptCount,
    });

    // update pinned to owner + draft — non-drafts and others' expenses 404
    const res = await db.expense.updateMany({
      where: { id, userId: ctx.userId, status: "draft" },
      data: { ...data, flags },
    });
    if (res.count === 0) return err(NOT_EDITABLE);

    await logAudit(db, ctx, {
      entity: "Expense",
      entityId: id,
      action: "expense.updated",
      meta: { amount: data.amount, merchant: data.merchant },
    });
    revalidatePath("/expenses");
    revalidatePath(`/expenses/${id}`);
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2025")) return err(NOT_EDITABLE);
    throw e;
  }
}

export async function deleteExpenseAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = expenseIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.expense.deleteMany({
      where: { id: parsed.data.id, userId: ctx.userId, status: "draft" },
    });
    if (res.count === 0) return err(NOT_EDITABLE);

    await logAudit(db, ctx, {
      entity: "Expense",
      entityId: parsed.data.id,
      action: "expense.deleted",
    });
    revalidatePath("/expenses");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

const RATE_NOT_SET =
  "Your organization's mileage rate isn't configured yet — ask a finance admin.";

export async function createMileageExpenseAction(
  input: unknown
): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireRole("employee");
    const parsed = mileageInputSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    const data = toMileageData(parsed.data, org.mileageRate);
    if (!data) return err(RATE_NOT_SET);

    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return err("Pick a valid category.");
    if (data.projectId) {
      const project = await db.project.findUnique({ where: { id: data.projectId } });
      if (!project) return err("Pick a valid project.");
    }

    const flags = await computeExpenseFlags(db, ctx.orgId, {
      expenseId: null,
      userId: ctx.userId,
      amount: data.amount,
      date: data.date,
      merchant: data.merchant,
      categoryId: data.categoryId,
      receiptCount: 0,
    });
    const expense = await db.expense.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        currency: org.currency,
        ...data,
        flags,
      },
    });
    await logAudit(db, ctx, {
      entity: "Expense",
      entityId: expense.id,
      action: "expense.created",
      meta: { type: "mileage", distanceKm: data.distanceKm, amount: data.amount, flagCount: flags.length },
    });
    revalidatePath("/expenses");
    return ok({ id: expense.id });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ id: string }>;
    throw e;
  }
}

export async function updateMileageExpenseAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = expenseIdSchema.merge(mileageInputSchema).safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const { id, ...rest } = parsed.data;

    const db = scopedDb(ctx.orgId);
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    const data = toMileageData(rest, org.mileageRate);
    if (!data) return err(RATE_NOT_SET);

    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return err("Pick a valid category.");
    if (data.projectId) {
      const project = await db.project.findUnique({ where: { id: data.projectId } });
      if (!project) return err("Pick a valid project.");
    }

    const receiptCount = await db.receipt.count({ where: { expenseId: id } });
    const flags = await computeExpenseFlags(db, ctx.orgId, {
      expenseId: id,
      userId: ctx.userId,
      amount: data.amount,
      date: data.date,
      merchant: data.merchant,
      categoryId: data.categoryId,
      receiptCount,
    });

    // pinned to owner + draft + mileage type — a regular expense can never
    // silently become a mileage one (or vice versa)
    const res = await db.expense.updateMany({
      where: { id, userId: ctx.userId, status: "draft", type: "mileage" },
      data: { ...data, flags },
    });
    if (res.count === 0) return err(NOT_EDITABLE);

    await logAudit(db, ctx, {
      entity: "Expense",
      entityId: id,
      action: "expense.updated",
      meta: { type: "mileage", distanceKm: data.distanceKm, amount: data.amount },
    });
    revalidatePath("/expenses");
    revalidatePath(`/expenses/${id}`);
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

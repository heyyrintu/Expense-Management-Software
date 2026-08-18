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
import { actingMeta, resolveActing } from "@/lib/auth/acting";
import { logAudit } from "@/lib/domain/audit";
import { toExpenseData, toMileageData } from "@/lib/domain/expense";
import {
  splitsFromAmounts,
  splitsSumExactly,
  type SplitEntry,
} from "@/lib/domain/expense-split";
import { computeExpenseFlags } from "@/lib/domain/policy-eval";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import {
  expenseIdSchema,
  expenseInputSchema,
  mileageInputSchema,
} from "@/lib/schemas/expense";
import { moneyString } from "@/lib/schemas/category";
import { convertToBase, isValidFxRate, parseToMinorUnits } from "@/lib/money";
import { z } from "zod";
import type { PolicyFlag } from "@/lib/domain/policy";

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
const BAD_RATE = "Enter a valid exchange rate for the foreign currency.";

/** 6.4: resolve currency/rate/base for an expense in org context. */
function resolveCurrency(
  orgCurrency: string,
  inputCurrency: string,
  inputFxRate: string,
  amount: number
): { currency: string; fxRate: string; baseAmount: number } | { error: string } {
  const currency = inputCurrency || orgCurrency;
  const fxRate = currency === orgCurrency ? "1" : inputFxRate.trim();
  if (!isValidFxRate(fxRate)) return { error: BAD_RATE };
  const baseAmount = convertToBase(amount, fxRate);
  if (baseAmount === null || baseAmount === 0) return { error: BAD_RATE };
  return { currency, fxRate, baseAmount };
}

/** 6.3: validate refs + build split entries; error on failure. */
async function resolveSplits(
  db: ReturnType<typeof scopedDb>,
  amount: number,
  rows: Array<{ categoryId: string; projectId: string; value: string }>
): Promise<{ splits: SplitEntry[] } | { error: string }> {
  if (rows.length === 0) return { splits: [] };
  const built = splitsFromAmounts(amount, rows);
  if ("error" in built) return built;
  if (!splitsSumExactly(amount, built.splits)) {
    return { error: "Split lines must add up exactly to the expense amount." };
  }
  for (const s of built.splits) {
    const cat = await db.category.findUnique({ where: { id: s.categoryId } });
    if (!cat) return { error: "Every split line needs a valid category." };
    if (s.projectId) {
      const proj = await db.project.findUnique({ where: { id: s.projectId } });
      if (!proj) return { error: "Every split line needs a valid project." };
    }
  }
  return { splits: built.splits };
}

async function validateClient(
  db: ReturnType<typeof scopedDb>,
  clientId: string | null
): Promise<string | null> {
  if (!clientId) return null;
  const client = await db.client.findUnique({ where: { id: clientId } });
  return client ? null : "Pick a valid client.";
}


export async function createExpenseAction(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireRole("employee");
    const acting = await resolveActing(ctx);
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

    const clientErr = await validateClient(db, data.clientId);
    if (clientErr) return err(clientErr);
    const resolved = await resolveSplits(db, data.amount, parsed.data.splits);
    if ("error" in resolved) return err(resolved.error);
    const cur = resolveCurrency(
      org.currency,
      parsed.data.currency,
      parsed.data.fxRate,
      data.amount
    );
    if ("error" in cur) return err(cur.error);

    // policy check runs inline at entry time — flags, never blocks (PRD 6.5).
    // Limits compare BASE amounts (6.4); splits convert via the same rate.
    const flags = await computeExpenseFlags(db, ctx.orgId, {
      expenseId: null,
      userId: acting.effectiveUserId,
      amount: data.amount,
      baseAmount: cur.baseAmount,
      date: data.date,
      merchant: data.merchant,
      categoryId: data.categoryId,
      receiptCount: 0,
      splits: resolved.splits.map((sp) => ({
        categoryId: sp.categoryId,
        amount: convertToBase(sp.amount, cur.fxRate) ?? sp.amount,
      })),
    });

    const expense = await db.expense.create({
      data: {
        orgId: ctx.orgId,
        userId: acting.effectiveUserId,
        ...data,
        currency: cur.currency,
        fxRate: cur.fxRate,
        baseAmount: cur.baseAmount,
        flags,
      },
    });
    for (const split of resolved.splits) {
      await db.expenseSplit.create({
        data: { orgId: ctx.orgId, expenseId: expense.id, ...split },
      });
    }
    await logAudit(db, ctx, {
      entity: "Expense",
      entityId: expense.id,
      action: "expense.created",
      meta: { amount: data.amount, merchant: data.merchant, flagCount: flags.length, ...actingMeta(acting) },
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
    const acting = await resolveActing(ctx);
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

    const clientErr = await validateClient(db, data.clientId);
    if (clientErr) return err(clientErr);
    const resolved = await resolveSplits(db, data.amount, parsed.data.splits);
    if ("error" in resolved) return err(resolved.error);
    const orgForUpdate = await db.organization.findUniqueOrThrow({
      where: { id: ctx.orgId },
    });
    const cur = resolveCurrency(
      orgForUpdate.currency,
      parsed.data.currency,
      parsed.data.fxRate,
      data.amount
    );
    if ("error" in cur) return err(cur.error);

    const receiptCount = await db.receipt.count({ where: { expenseId: id } });
    const flags = await computeExpenseFlags(db, ctx.orgId, {
      expenseId: id,
      userId: acting.effectiveUserId,
      amount: data.amount,
      baseAmount: cur.baseAmount,
      date: data.date,
      merchant: data.merchant,
      categoryId: data.categoryId,
      receiptCount,
      splits: resolved.splits.map((sp) => ({
        categoryId: sp.categoryId,
        amount: convertToBase(sp.amount, cur.fxRate) ?? sp.amount,
      })),
    });

    // update pinned to owner + draft — non-drafts and others' expenses 404
    const res = await db.expense.updateMany({
      where: { id, userId: acting.effectiveUserId, status: "draft" },
      data: {
        ...data,
        currency: cur.currency,
        fxRate: cur.fxRate,
        baseAmount: cur.baseAmount,
        flags,
      },
    });
    if (res.count === 0) return err(NOT_EDITABLE);

    // splits: replace wholesale (draft-only path)
    await db.expenseSplit.deleteMany({ where: { expenseId: id } });
    for (const split of resolved.splits) {
      await db.expenseSplit.create({
        data: { orgId: ctx.orgId, expenseId: id, ...split },
      });
    }

    await logAudit(db, ctx, {
      entity: "Expense",
      entityId: id,
      action: "expense.updated",
      meta: { amount: data.amount, merchant: data.merchant, ...actingMeta(acting) },
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
    const acting = await resolveActing(ctx);
    const parsed = expenseIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const owned = await db.expense.findUnique({
      where: { id: parsed.data.id, userId: acting.effectiveUserId, status: "draft" },
      select: { id: true },
    });
    if (!owned) return err(NOT_EDITABLE);
    await db.expenseSplit.deleteMany({ where: { expenseId: owned.id } });
    const res = await db.expense.deleteMany({
      where: { id: parsed.data.id, userId: acting.effectiveUserId, status: "draft" },
    });
    if (res.count === 0) return err(NOT_EDITABLE);

    await logAudit(db, ctx, {
      entity: "Expense",
      entityId: parsed.data.id,
      action: "expense.deleted",
      meta: actingMeta(acting),
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
      baseAmount: data.amount, // mileage is always org-currency
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
        fxRate: "1",
        baseAmount: data.amount,
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
      baseAmount: data.amount,
      date: data.date,
      merchant: data.merchant,
      categoryId: data.categoryId,
      receiptCount,
    });

    // pinned to owner + draft + mileage type — a regular expense can never
    // silently become a mileage one (or vice versa)
    const res = await db.expense.updateMany({
      where: { id, userId: ctx.userId, status: "draft", type: "mileage" },
      data: { ...data, fxRate: "1", baseAmount: data.amount, flags },
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

const previewSchema = z.object({
  amount: moneyString,
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  fxRate: z.string().trim().max(13).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().max(80),
  categoryId: z.string().uuid(),
  expenseId: z.union([z.literal(""), z.string().uuid()]),
  receiptCount: z.number().int().min(0).max(100),
});

/** Inline policy check at entry time (3.2) — read-only, never blocks. */
export async function previewExpenseFlagsAction(
  input: unknown
): Promise<Result<{ flags: PolicyFlag[] }>> {
  try {
    const ctx = await requireRole("employee");
    const parsed = previewSchema.safeParse(input);
    if (!parsed.success) return ok({ flags: [] }); // incomplete form — no noise
    const amount = parseToMinorUnits(parsed.data.amount);
    if (amount === null || amount === 0) return ok({ flags: [] });

    const rate = parsed.data.fxRate && isValidFxRate(parsed.data.fxRate)
      ? parsed.data.fxRate
      : "1";
    const flags = await computeExpenseFlags(scopedDb(ctx.orgId), ctx.orgId, {
      expenseId: parsed.data.expenseId === "" ? null : parsed.data.expenseId,
      userId: ctx.userId,
      amount,
      baseAmount: convertToBase(amount, rate) ?? amount,
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
      merchant: parsed.data.merchant,
      categoryId: parsed.data.categoryId,
      receiptCount: parsed.data.receiptCount,
    });
    return ok({ flags });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ flags: PolicyFlag[] }>;
    throw e;
  }
}

const fxLookupSchema = z.object({ currency: z.string().regex(/^[A-Z]{3}$/) });

/** 6.4: stub-rate prefill for the form; null → user enters the rate. */
export async function getFxRateAction(
  input: unknown
): Promise<Result<{ rate: string | null; baseCurrency: string }>> {
  try {
    const ctx = await requireRole("employee");
    const parsed = fxLookupSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const org = await scopedDb(ctx.orgId).organization.findUniqueOrThrow({
      where: { id: ctx.orgId },
    });
    const { getFxRate } = await import("@/lib/fx");
    const rate = await getFxRate(parsed.data.currency, org.currency);
    return ok({ rate, baseCurrency: org.currency });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ rate: string | null; baseCurrency: string }>;
    throw e;
  }
}

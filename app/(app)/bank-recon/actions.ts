"use server";

// Manual reconciliation actions (7.2). Locked imports refuse every edit.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { outstandingBalance, planPayment } from "@/lib/domain/reimbursement";
import {
  expenseStatusFor,
  nextStatus,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb, type ScopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { z } from "zod";

const LOCKED = "This statement period is locked.";

const matchSchema = z.object({
  lineId: z.string().uuid(),
  reimbursementId: z.string().uuid(),
});
const lineSchema = z.object({ lineId: z.string().uuid() });
const recordSchema = z.object({
  lineId: z.string().uuid(),
  reportId: z.string().uuid(),
});
const importSchema = z.object({ importId: z.string().uuid() });

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

type LoadedLine = {
  id: string;
  amount: number;
  date: Date;
  reference: string;
  matchedReimbursementId: string | null;
  import: { id: string; lockedAt: Date | null };
};

async function unlockedLine(
  db: ScopedDb,
  lineId: string
): Promise<{ ok: false; error: string } | { ok: true; line: LoadedLine }> {
  const line = (await db.bankStatementLine.findUnique({
    where: { id: lineId },
    include: { import: { select: { id: true, lockedAt: true } } },
  })) as LoadedLine | null;
  if (!line) return { ok: false, error: "Statement line not found." };
  if (line.import.lockedAt) return { ok: false, error: LOCKED };
  return { ok: true, line };
}

export async function manualMatchAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = matchSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const found = await unlockedLine(db, parsed.data.lineId);
    if (!found.ok) return err(found.error);
    if (found.line.matchedReimbursementId) return err("That line is already matched.");

    const payment = await db.reimbursement.findUnique({
      where: { id: parsed.data.reimbursementId },
      include: { bankLine: { select: { id: true } } },
    });
    if (!payment) return err("Payment not found.");
    if (payment.bankLine) return err("That payment is already reconciled.");

    await db.bankStatementLine.update({
      where: { id: found.line.id },
      data: { matchedReimbursementId: payment.id, matchType: "manual" },
    });
    await logAudit(db, ctx, {
      entity: "BankStatementImport",
      entityId: found.line.import.id,
      action: "bank.line_matched",
      meta: { lineId: found.line.id, reimbursementId: payment.id, matchType: "manual" },
    });
    revalidatePath("/bank-recon");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function unmatchLineAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = lineSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const found = await unlockedLine(db, parsed.data.lineId);
    if (!found.ok) return err(found.error);
    if (!found.line.matchedReimbursementId) return err("That line isn't matched.");

    await db.bankStatementLine.update({
      where: { id: found.line.id },
      data: { matchedReimbursementId: null, matchType: null },
    });
    await logAudit(db, ctx, {
      entity: "BankStatementImport",
      entityId: found.line.import.id,
      action: "bank.line_unmatched",
      meta: { lineId: found.line.id },
    });
    revalidatePath("/bank-recon");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

/** In-bank-not-in-app: record the payment against a payable report and
 *  reconcile the line to it in one step (flows straight into the ledger). */
export async function recordPaymentFromLineAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = recordSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const found = await unlockedLine(db, parsed.data.lineId);
    if (!found.ok) return err(found.error);
    if (found.line.matchedReimbursementId) return err("That line is already matched.");

    const report = await db.expenseReport.findUnique({
      where: { id: parsed.data.reportId },
      include: {
        user: { select: { id: true, email: true } },
        reimbursements: { select: { amountPaid: true } },
      },
    });
    if (!report) return err("Report not found.");
    const balance = outstandingBalance(report.total, report.reimbursements);
    const plan = planPayment(balance, found.line.amount);
    if ("error" in plan) return err(plan.error);
    const to = nextStatus(report.status as ReportStatus, plan.action);
    if (!to) return err("Only approved or partially reimbursed reports can be paid.");

    const payment = await db.reimbursement.create({
      data: {
        orgId: ctx.orgId,
        reportId: report.id,
        amount: report.total,
        amountPaid: found.line.amount,
        method: "bank_transfer",
        paidAt: found.line.date,
        reference: found.line.reference.slice(0, 120) || "bank statement",
        paidById: ctx.userId,
      },
    });
    await db.expenseReport.update({ where: { id: report.id }, data: { status: to } });
    await db.expense.updateMany({
      where: { reportId: report.id },
      data: { status: expenseStatusFor(to) },
    });
    await db.bankStatementLine.update({
      where: { id: found.line.id },
      data: { matchedReimbursementId: payment.id, matchType: "manual" },
    });
    await logAudit(db, ctx, {
      entity: "BankStatementImport",
      entityId: found.line.import.id,
      action: "bank.payment_recorded",
      meta: {
        lineId: found.line.id,
        reportId: report.id,
        amountPaid: found.line.amount,
        newStatus: to,
      },
    });
    revalidatePath("/bank-recon");
    revalidatePath("/finance");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function lockImportAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = importSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.bankStatementImport.updateMany({
      where: { id: parsed.data.importId, lockedAt: null },
      data: { lockedAt: new Date() },
    });
    if (res.count === 0) return err("Import not found or already locked.");
    await logAudit(db, ctx, {
      entity: "BankStatementImport",
      entityId: parsed.data.importId,
      action: "bank.period_locked",
    });
    revalidatePath("/bank-recon");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

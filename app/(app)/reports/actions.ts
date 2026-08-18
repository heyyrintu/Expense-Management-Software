"use server";

// Report lifecycle actions (2.1: employee side — create, attach, submit,
// withdraw). Every status change goes through nextStatus() and writes an
// AuditLog row. Ownership: all where-clauses pin the session user.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { resolveChain, type ChainRule } from "@/lib/domain/approval-chain";
import { logAudit } from "@/lib/domain/audit";
import { checkBudgetAlertsAfterSubmit } from "@/lib/domain/budget-alerts";
import { secondApprovalThreshold } from "@/lib/domain/org-settings";
import {
  computeReportTotal,
  expenseStatusFor,
  isReportDeletable,
  isReportEditable,
  nextStatus,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb, type ScopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { notify } from "@/lib/notifications";
import {
  reportCreateSchema,
  reportExpenseSchema,
  reportIdSchema,
} from "@/lib/schemas/report";

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

async function ownReport(db: ScopedDb, id: string, userId: string) {
  return db.expenseReport.findUnique({
    where: { id, userId },
    include: { expenses: { select: { id: true, amount: true } } },
  });
}

export async function createReportAction(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireRole("employee");
    const parsed = reportCreateSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const report = await db.expenseReport.create({
      data: { orgId: ctx.orgId, userId: ctx.userId, title: parsed.data.title },
    });
    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: "report.created",
      meta: { title: parsed.data.title },
    });
    revalidatePath("/reports");
    return ok({ id: report.id });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ id: string }>;
    throw e;
  }
}

export async function deleteReportAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = reportIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const report = await ownReport(db, parsed.data.id, ctx.userId);
    if (!report || !isReportDeletable(report.status as ReportStatus)) {
      return err("Only draft reports can be deleted.");
    }

    await db.expense.updateMany({
      where: { reportId: report.id },
      data: { reportId: null },
    });
    await db.expenseReport.delete({ where: { id: report.id } });
    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: "report.deleted",
    });
    revalidatePath("/reports");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function addExpenseToReportAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = reportExpenseSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const report = await ownReport(db, parsed.data.reportId, ctx.userId);
    if (!report || !isReportEditable(report.status as ReportStatus)) {
      return err("Expenses can only be added to an editable report.");
    }

    // own draft expense, not already on another report
    const res = await db.expense.updateMany({
      where: {
        id: parsed.data.expenseId,
        userId: ctx.userId,
        status: "draft",
        reportId: null,
      },
      data: { reportId: report.id },
    });
    if (res.count === 0) return err("That expense can't be added.");

    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: "report.expense_added",
      meta: { expenseId: parsed.data.expenseId },
    });
    revalidatePath(`/reports/${report.id}`);
    revalidatePath("/expenses");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function removeExpenseFromReportAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = reportExpenseSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const report = await ownReport(db, parsed.data.reportId, ctx.userId);
    if (!report || !isReportEditable(report.status as ReportStatus)) {
      return err("Expenses can only be removed from an editable report.");
    }

    const res = await db.expense.updateMany({
      where: {
        id: parsed.data.expenseId,
        userId: ctx.userId,
        reportId: report.id,
      },
      data: { reportId: null },
    });
    if (res.count === 0) return err("That expense isn't on this report.");

    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: "report.expense_removed",
      meta: { expenseId: parsed.data.expenseId },
    });
    revalidatePath(`/reports/${report.id}`);
    revalidatePath("/expenses");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function submitReportAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = reportIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const report = await ownReport(db, parsed.data.id, ctx.userId);
    if (!report) return err("Report not found.");

    const to = nextStatus(report.status as ReportStatus, "submit");
    if (!to) return err("This report can't be submitted.");
    if (report.expenses.length === 0) {
      return err("Add at least one expense before submitting.");
    }

    const total = computeReportTotal(
      report.expenses.map((e: { amount: number }) => e.amount)
    );
    await db.expenseReport.update({
      where: { id: report.id },
      data: { status: to, submittedAt: new Date(), total },
    });
    await db.expense.updateMany({
      where: { reportId: report.id },
      data: { status: expenseStatusFor(to) },
    });
    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: "report.submitted",
      meta: { total, expenseCount: report.expenses.length, from: report.status },
    });

    // notify whoever the chain routes level 1 to (5.4; assigned approver by default)
    const me = await db.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { name: true, approverId: true, departmentId: true },
    });
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    const rules = (await db.approvalRule.findMany({
      orderBy: { createdAt: "asc" },
    })) as ChainRule[];
    const chain = resolveChain({
      ownerAssignedApproverId: me.approverId,
      ownerDepartmentId: me.departmentId,
      total,
      orgThreshold: secondApprovalThreshold(org.settings),
      rules,
    });
    if (chain.level1ApproverId && chain.level1ApproverId !== ctx.userId) {
      const approver = (await db.user.findUnique({
        where: { id: chain.level1ApproverId, status: "active" },
        select: { id: true, email: true },
      })) as { id: string; email: string } | null;
      if (approver) {
        await notify(db, ctx.orgId, [approver], "report.submitted", {
          reportId: report.id,
          reportTitle: report.title,
          actorName: me.name,
          totalFormatted: formatMoney(total, org.currency),
        });
      }
    }
    // budget 80%/100% alerts (5.1) — never blocks submission
    await checkBudgetAlertsAfterSubmit(db, ctx.orgId, report.id);
    revalidatePath("/reports");
    revalidatePath(`/reports/${report.id}`);
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function withdrawReportAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = reportIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const report = await ownReport(db, parsed.data.id, ctx.userId);
    if (!report) return err("Report not found.");

    const to = nextStatus(report.status as ReportStatus, "withdraw");
    if (!to) return err("Only submitted reports can be withdrawn.");

    await db.expenseReport.update({
      where: { id: report.id },
      data: { status: to },
    });
    await db.expense.updateMany({
      where: { reportId: report.id },
      data: { status: expenseStatusFor(to) },
    });
    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: "report.withdrawn",
      meta: { from: report.status },
    });
    revalidatePath("/reports");
    revalidatePath(`/reports/${report.id}`);
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

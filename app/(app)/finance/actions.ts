"use server";

// Reimbursement (task 4.1) — finance_admin+. approved → reimbursed through
// the state machine; a Reimbursement row records payment date + reference;
// AuditLog + owner notification per report. Batch = loop of the single path.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
  type SessionCtx,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import {
  expenseStatusFor,
  nextStatus,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { z } from "zod";

const reimburseSchema = z.object({
  reportIds: z.array(z.string().uuid()).min(1).max(100),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a payment date")
    .refine((s) => !Number.isNaN(Date.parse(s)), "Pick a valid date"),
  reference: z.string().trim().min(1, "A payment reference is required").max(120),
});

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

async function reimburseOne(
  ctx: SessionCtx,
  reportId: string,
  paidAt: Date,
  reference: string
): Promise<Result> {
  const db = scopedDb(ctx.orgId);
  const report = await db.expenseReport.findUnique({
    where: { id: reportId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!report) return err("Report not found.");

  const to = nextStatus(report.status as ReportStatus, "reimburse");
  if (!to) return err("Only approved reports can be reimbursed.");

  await db.reimbursement.create({
    data: {
      orgId: ctx.orgId,
      reportId: report.id,
      amount: report.total,
      paidAt,
      reference,
      paidById: ctx.userId,
    },
  });
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
    action: "report.reimbursed",
    meta: { amount: report.total, reference, paidAt: paidAt.toISOString() },
  });

  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  await notify(
    db,
    ctx.orgId,
    [{ id: report.user.id, email: report.user.email }],
    "report.reimbursed",
    {
      reportId: report.id,
      reportTitle: report.title,
      totalFormatted: formatMoney(report.total, org.currency),
    }
  );
  return ok(undefined);
}

export async function reimburseReportsAction(
  input: unknown
): Promise<Result<{ reimbursed: number; failed: number }>> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = reimburseSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const paidAt = new Date(`${parsed.data.paidAt}T00:00:00.000Z`);

    let reimbursed = 0;
    let failed = 0;
    for (const id of parsed.data.reportIds) {
      const res = await reimburseOne(ctx, id, paidAt, parsed.data.reference);
      if (res.ok) reimbursed += 1;
      else failed += 1;
    }
    revalidatePath("/finance");
    revalidatePath("/reports");
    return ok({ reimbursed, failed });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ reimbursed: number; failed: number }>;
    throw e;
  }
}

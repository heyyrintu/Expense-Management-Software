"use server";

// Approval decisions (task 2.2). All transitions via report-workflow's
// nextStatus(); Approval + AuditLog rows on every decision; self-approval
// structurally impossible via canDecideAtLevel().
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
  type SessionCtx,
} from "@/lib/auth/guard";
import {
  canDecideAtLevel,
  currentSubmissionApprovals,
  isReportFlagged,
  pendingLevel,
  requiredLevels,
  type ApprovalRow,
} from "@/lib/domain/approvals";
import { logAudit } from "@/lib/domain/audit";
import { secondApprovalThreshold } from "@/lib/domain/org-settings";
import {
  detachExpensesOnReject,
  expenseStatusFor,
  nextStatus,
  requiresReason,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { bulkApproveSchema, decisionSchema } from "@/lib/schemas/approval";

const NOT_ELIGIBLE = "This report isn't awaiting your decision.";

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

type LoadedReport = {
  id: string;
  userId: string;
  status: string;
  total: number;
  submittedAt: Date | null;
  user: { approverId: string | null };
  approvals: ApprovalRow[];
  expenses: { flags: unknown }[];
};

async function decideOne(
  ctx: SessionCtx,
  input: { reportId: string; action: "approve" | "reject" | "send_back"; reason?: string },
  opts?: { requireUnflagged?: boolean }
): Promise<Result> {
  const db = scopedDb(ctx.orgId);
  const report = (await db.expenseReport.findUnique({
    where: { id: input.reportId },
    include: {
      user: { select: { approverId: true } },
      approvals: {
        select: { level: true, action: true, approverId: true, actedAt: true },
      },
      expenses: { select: { flags: true } },
    },
  })) as LoadedReport | null;
  if (!report || report.status !== "submitted") return err(NOT_ELIGIBLE);

  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const threshold = secondApprovalThreshold(org.settings);
  const required = requiredLevels(report.total, threshold);
  const current = currentSubmissionApprovals(report.approvals, report.submittedAt);
  const level = pendingLevel(current, required);
  if (!level) return err(NOT_ELIGIBLE);

  const level1ApproverId =
    current.find((a) => a.level === 1 && a.action === "approved")?.approverId ??
    null;
  if (
    !canDecideAtLevel({
      actorId: ctx.userId,
      actorRole: ctx.role,
      ownerId: report.userId,
      ownerApproverId: report.user.approverId,
      level1ApproverId,
      level,
    })
  ) {
    return err(NOT_ELIGIBLE);
  }

  if (
    opts?.requireUnflagged &&
    isReportFlagged(report.expenses.map((e) => e.flags))
  ) {
    return err("Flagged reports need individual review.");
  }

  const workflowAction = input.action === "approve" ? "approve" : input.action;
  if (requiresReason(workflowAction) && !input.reason) {
    return err("A reason is required.");
  }

  const approvalAction =
    input.action === "approve"
      ? "approved"
      : input.action === "reject"
        ? "rejected"
        : "sent_back";

  await db.approval.create({
    data: {
      orgId: ctx.orgId,
      reportId: report.id,
      approverId: ctx.userId,
      level,
      action: approvalAction,
      reason: input.reason ?? null,
    },
  });

  const intermediateApproval =
    input.action === "approve" && level === 1 && required === 2;

  if (intermediateApproval) {
    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: "report.approved_level1",
      meta: { total: report.total, awaiting: "level2" },
    });
  } else {
    const to = nextStatus(report.status as ReportStatus, workflowAction);
    if (!to) return err(NOT_ELIGIBLE);
    await db.expenseReport.update({
      where: { id: report.id },
      data: { status: to },
    });
    if (input.action === "reject") {
      await db.expense.updateMany({
        where: { reportId: report.id },
        data: detachExpensesOnReject(),
      });
    } else {
      await db.expense.updateMany({
        where: { reportId: report.id },
        data: { status: expenseStatusFor(to) },
      });
    }
    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: `report.${approvalAction}`,
      meta: { level, reason: input.reason ?? null, total: report.total },
    });
  }

  revalidatePath("/approvals");
  revalidatePath(`/approvals/${report.id}`);
  revalidatePath("/reports");
  return ok(undefined);
}

export async function decideReportAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("approver");
    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    return await decideOne(ctx, parsed.data);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function bulkApproveAction(
  input: unknown
): Promise<Result<{ approved: number; skipped: number }>> {
  try {
    const ctx = await requireRole("approver");
    const parsed = bulkApproveSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    let approved = 0;
    let skipped = 0;
    for (const reportId of parsed.data.reportIds) {
      const res = await decideOne(
        ctx,
        { reportId, action: "approve" },
        { requireUnflagged: true }
      );
      if (res.ok) approved += 1;
      else skipped += 1;
    }
    return ok({ approved, skipped });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ approved: number; skipped: number }>;
    throw e;
  }
}

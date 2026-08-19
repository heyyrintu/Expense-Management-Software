// Report decision engine (2.2), extracted so every channel runs the SAME
// path: the web approval screen, bulk approve, and WhatsApp quick approve
// (8.3) all call decideReport(). Eligibility, the flagged-report rule, the
// state machine, the Approval row, the AuditLog entry and the owner
// notification live here — nothing may re-implement them.
import {
  resolveChain,
  type ChainRule,
} from "@/lib/domain/approval-chain";
import {
  canDecideAtLevel,
  currentSubmissionApprovals,
  isReportFlagged,
  pendingLevel,
  validateDecisionReason,
  type ApprovalRow,
} from "@/lib/domain/approvals";
import { logAudit } from "@/lib/domain/audit";
import { secondApprovalThreshold } from "@/lib/domain/org-settings";
import {
  detachExpensesOnReject,
  expenseStatusFor,
  nextStatus,
  type ReportStatus,
} from "@/lib/domain/report-workflow";
import { scopedDb } from "@/lib/db/scoped";
import type { SessionCtx } from "@/lib/auth/guard";
import { type Result, ok, err } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { notify } from "@/lib/notifications";

const NOT_ELIGIBLE = "This report isn't awaiting your decision.";


type LoadedReport = {
  id: string;
  userId: string;
  title: string;
  status: string;
  total: number;
  submittedAt: Date | null;
  user: {
    id: string;
    name: string;
    email: string;
    approverId: string | null;
    departmentId: string | null;
  };
  approvals: ApprovalRow[];
  expenses: { flags: unknown }[];
};

export async function decideReport(
  ctx: SessionCtx,
  input: { reportId: string; action: "approve" | "reject" | "send_back"; reason?: string },
  opts?: { requireUnflagged?: boolean; channel?: "web" | "whatsapp" }
): Promise<Result> {
  const db = scopedDb(ctx.orgId);
  const report = (await db.expenseReport.findUnique({
    where: { id: input.reportId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          approverId: true,
          departmentId: true,
        },
      },
      approvals: {
        select: { level: true, action: true, approverId: true, actedAt: true },
      },
      expenses: { select: { flags: true } },
    },
  })) as LoadedReport | null;
  if (!report || report.status !== "submitted") return err(NOT_ELIGIBLE);

  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const threshold = secondApprovalThreshold(org.settings);
  const rules = (await db.approvalRule.findMany({
    orderBy: { createdAt: "asc" },
  })) as ChainRule[];
  const chain = resolveChain({
    ownerAssignedApproverId: report.user.approverId,
    ownerDepartmentId: report.user.departmentId,
    total: report.total,
    orgThreshold: threshold,
    rules,
  });
  const required = chain.level2 ? 2 : 1;
  const current = currentSubmissionApprovals(report.approvals, report.submittedAt);
  const level = pendingLevel(current, required);
  if (!level) return err(NOT_ELIGIBLE);

  const decidedLevel1Id =
    current.find((a) => a.level === 1 && a.action === "approved")?.approverId ??
    null;
  if (
    !canDecideAtLevel({
      actorId: ctx.userId,
      actorRole: ctx.role,
      ownerId: report.userId,
      responsibleLevel1Id: chain.level1ApproverId,
      decidedLevel1Id,
      level2: chain.level2,
      level,
    })
  ) {
    return err(NOT_ELIGIBLE);
  }

  const flagged = isReportFlagged(report.expenses.map((e) => e.flags));
  if (opts?.requireUnflagged && flagged) {
    return err("Flagged reports need individual review.");
  }

  const workflowAction = input.action === "approve" ? "approve" : input.action;
  const reasonError = validateDecisionReason(input.action, flagged, input.reason);
  if (reasonError) return err(reasonError);

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

  const actor = await db.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { name: true },
  });
  const totalFormatted = formatMoney(report.total, org.currency);

  if (intermediateApproval) {
    await logAudit(db, ctx, {
      entity: "ExpenseReport",
      entityId: report.id,
      action: "report.approved_level1",
      meta: {
        total: report.total,
        awaiting: "level2",
        channel: opts?.channel ?? "web",
      },
    });
    // tell whoever owns level 2: the chain-pinned approver, else finance pool
    const level2Recipients =
      chain.level2?.type === "user"
        ? ((await db.user.findMany({
            where: { id: chain.level2.userId, status: "active" },
            select: { id: true, email: true },
          })) as Array<{ id: string; email: string }>)
        : ((await db.user.findMany({
            where: {
              status: "active",
              role: { in: ["finance_admin", "org_admin"] },
              id: { notIn: [report.userId, ctx.userId] },
            },
            select: { id: true, email: true },
          })) as Array<{ id: string; email: string }>);
    await notify(db, ctx.orgId, level2Recipients, "report.approved_level1", {
      reportId: report.id,
      reportTitle: report.title,
      actorName: actor.name,
      totalFormatted,
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
      meta: {
        level,
        reason: input.reason ?? null,
        total: report.total,
        flagged,
        channel: opts?.channel ?? "web",
        ...(input.action === "approve" && flagged
          ? { justification: input.reason }
          : {}),
      },
    });
    // tell the owner what happened (2.3)
    const event =
      input.action === "approve"
        ? ("report.approved" as const)
        : input.action === "reject"
          ? ("report.rejected" as const)
          : ("report.sent_back" as const);
    await notify(
      db,
      ctx.orgId,
      [{ id: report.user.id, email: report.user.email }],
      event,
      {
        reportId: report.id,
        reportTitle: report.title,
        actorName: actor.name,
        reason: input.reason,
        totalFormatted,
      }
    );
  }

  return ok(undefined);
}

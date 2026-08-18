// Server-side queue assembly for an approver (used by the inbox page).
// Pure filtering happens in lib/domain/approvals; this composes the query.
import type { Role } from "@/lib/auth/roles";
import {
  canDecideAtLevel,
  currentSubmissionApprovals,
  isReportFlagged,
  pendingLevel,
  requiredLevels,
  type ApprovalRow,
} from "@/lib/domain/approvals";
import { secondApprovalThreshold } from "@/lib/domain/org-settings";
import type { ScopedDb } from "@/lib/db/scoped";

export type QueueItem = {
  id: string;
  title: string;
  total: number;
  submittedAt: Date | null;
  ownerName: string;
  expenseCount: number;
  level: 1 | 2;
  flagged: boolean;
};

export async function approvalQueueFor(
  db: ScopedDb,
  ctx: { userId: string; orgId: string; role: Role }
): Promise<QueueItem[]> {
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const threshold = secondApprovalThreshold(org.settings);

  const submitted = (await db.expenseReport.findMany({
    where: { status: "submitted" },
    orderBy: { submittedAt: "asc" },
    take: 200,
    include: {
      user: { select: { name: true, approverId: true } },
      approvals: {
        select: { level: true, action: true, approverId: true, actedAt: true },
      },
      expenses: { select: { flags: true } },
    },
  })) as Array<{
    id: string;
    userId: string;
    title: string;
    total: number;
    submittedAt: Date | null;
    user: { name: string; approverId: string | null };
    approvals: ApprovalRow[];
    expenses: { flags: unknown }[];
  }>;

  const queue: QueueItem[] = [];
  for (const r of submitted) {
    const required = requiredLevels(r.total, threshold);
    const current = currentSubmissionApprovals(r.approvals, r.submittedAt);
    const level = pendingLevel(current, required);
    if (!level) continue;
    const level1ApproverId =
      current.find((a) => a.level === 1 && a.action === "approved")?.approverId ??
      null;
    if (
      canDecideAtLevel({
        actorId: ctx.userId,
        actorRole: ctx.role,
        ownerId: r.userId,
        ownerApproverId: r.user.approverId,
        level1ApproverId,
        level,
      })
    ) {
      queue.push({
        id: r.id,
        title: r.title,
        total: r.total,
        submittedAt: r.submittedAt,
        ownerName: r.user.name,
        expenseCount: r.expenses.length,
        level,
        flagged: isReportFlagged(r.expenses.map((e) => e.flags)),
      });
    }
  }
  return queue;
}

// Server-side queue assembly for an approver (used by the inbox page).
// Pure filtering happens in lib/domain/approvals; this composes the query.
import type { Role } from "@/lib/auth/roles";
import {
  resolveChain,
  type ChainRule,
} from "@/lib/domain/approval-chain";
import {
  canDecideAtLevel,
  currentSubmissionApprovals,
  isReportFlagged,
  pendingLevel,
  type ApprovalRow,
} from "@/lib/domain/approvals";
import { secondApprovalThreshold } from "@/lib/domain/org-settings";
import type { ScopedDb } from "@/lib/db/scoped";
import { asFlags, type FlagLike } from "@/lib/domain/policy-flags";

export type QueueItem = {
  id: string;
  title: string;
  total: number;
  submittedAt: Date | null;
  ownerName: string;
  expenseCount: number;
  level: 1 | 2;
  flagged: boolean;
  /**
   * Distinct category names, most-used first. §7.3 asks for enough to decide
   * WITHOUT OPENING, and "what kind of spending is this" is the question an
   * approver answers before any other.
   */
  categories: string[];
  /** Every flag on the report, deduped by rule — the chips on the row. */
  flags: FlagLike[];
};

export async function approvalQueueFor(
  db: ScopedDb,
  ctx: { userId: string; orgId: string; role: Role }
): Promise<QueueItem[]> {
  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const threshold = secondApprovalThreshold(org.settings);
  const rules = (await db.approvalRule.findMany({
    orderBy: { createdAt: "asc" },
  })) as ChainRule[];

  const submitted = (await db.expenseReport.findMany({
    where: { status: "submitted" },
    orderBy: { submittedAt: "asc" },
    take: 200,
    include: {
      user: { select: { name: true, approverId: true, departmentId: true } },
      approvals: {
        select: { level: true, action: true, approverId: true, actedAt: true },
      },
      expenses: { select: { flags: true, category: { select: { name: true } } } },
    },
  })) as Array<{
    id: string;
    userId: string;
    title: string;
    total: number;
    submittedAt: Date | null;
    user: { name: string; approverId: string | null; departmentId: string | null };
    approvals: ApprovalRow[];
    expenses: { flags: unknown; category: { name: string } }[];
  }>;

  const queue: QueueItem[] = [];
  for (const r of submitted) {
    const chain = resolveChain({
      ownerAssignedApproverId: r.user.approverId,
      ownerDepartmentId: r.user.departmentId,
      total: r.total,
      orgThreshold: threshold,
      rules,
    });
    const required = chain.level2 ? 2 : 1;
    const current = currentSubmissionApprovals(r.approvals, r.submittedAt);
    const level = pendingLevel(current, required);
    if (!level) continue;
    const decidedLevel1Id =
      current.find((a) => a.level === 1 && a.action === "approved")?.approverId ??
      null;
    if (
      canDecideAtLevel({
        actorId: ctx.userId,
        actorRole: ctx.role,
        ownerId: r.userId,
        responsibleLevel1Id: chain.level1ApproverId,
        decidedLevel1Id,
        level2: chain.level2,
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
        categories: summariseCategories(r.expenses),
        flags: dedupeFlags(r.expenses),
      });
    }
  }
  return sortApprovalQueue(queue);
}

/**
 * Category names by how much of the report they account for, most first.
 * A report that is nine taxi rides and one hotel should read "Travel,
 * Lodging", not whichever happened to be entered first.
 */
export function summariseCategories(
  expenses: Array<{ category: { name: string } }>
): string[] {
  const counts = new Map<string, number>();
  for (const e of expenses) {
    counts.set(e.category.name, (counts.get(e.category.name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

/**
 * One chip per RULE, not per expense. Six expenses over the same limit is one
 * fact an approver needs to know, not six identical chips to read past.
 */
export function dedupeFlags(expenses: Array<{ flags: unknown }>): FlagLike[] {
  const byRule = new Map<string, FlagLike>();
  for (const e of expenses) {
    for (const flag of asFlags(e.flags)) {
      if (!byRule.has(flag.rule)) byRule.set(flag.rule, flag);
    }
  }
  return [...byRule.values()];
}

/**
 * FLAGGED FIRST (§7.3), then oldest first.
 *
 * Both halves matter. Flagged reports need a human decision that bulk approve
 * deliberately can't give them, so burying them under fifty clean ones is how
 * they age out. Within each group, oldest first — a queue that surfaces the
 * newest item is a queue whose bottom never gets read.
 */
export function sortApprovalQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    const aAt = a.submittedAt?.getTime() ?? 0;
    const bAt = b.submittedAt?.getTime() ?? 0;
    return aAt - bAt;
  });
}

// WhatsApp quick approve (8.3).
//
// The button is a shortcut, NOT a second implementation: it builds the same
// SessionCtx the web uses and calls decideReport(), so eligibility, the
// approval chain, self-approval blocking, the state machine, the Approval
// row, the AuditLog entry and the owner notification are all identical.
//
// Two things chat can never do:
//   * approve a policy-flagged report — that needs the flags on screen and a
//     written justification, so it is refused here even if a stale button is
//     tapped
//   * reject or send back — a reason is mandatory, so those live in the app
import type { ScopedDb } from "@/lib/db/scoped";
import type { SessionCtx } from "@/lib/auth/guard";
import { isReportFlagged } from "@/lib/domain/approvals";
import { decideReport } from "@/lib/domain/report-decision";
import { roleAtLeast, type Role } from "@/lib/auth/roles";
import {
  QUICK_APPROVE_REPLIES,
  openInAppReply,
  type QuickAction,
} from "./templates";

export function reportUrl(reportId: string): string {
  const base = (process.env.AUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/approvals/${reportId}`;
}

type ReportRow = {
  id: string;
  title: string;
  status: string;
  userId: string;
  expenses: Array<{ flags: unknown }>;
};

/**
 * `actorUserId` is the person whose VERIFIED number sent the tap — resolved by
 * the webhook, never taken from the payload. A payload naming a report the
 * actor may not decide is refused with the same neutral message as one that
 * does not exist.
 */
export async function handleQuickApprove(
  db: ScopedDb,
  orgId: string,
  actor: { userId: string; role: Role },
  action: QuickAction,
  reportId: string
): Promise<{ reply: string }> {
  const report = (await db.expenseReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      title: true,
      status: true,
      userId: true,
      expenses: { select: { flags: true } },
    },
  })) as ReportRow | null;
  if (!report) return { reply: QUICK_APPROVE_REPLIES.gone };

  if (action === "open") {
    return { reply: openInAppReply(reportUrl(report.id)) };
  }

  // Role gate — the chat equivalent of requireRole("approver").
  if (!roleAtLeast(actor.role, "approver")) {
    return { reply: QUICK_APPROVE_REPLIES.notAllowed };
  }
  // Self-approval is blocked inside decideReport too; this is the early,
  // friendlier answer.
  if (report.userId === actor.userId) {
    return { reply: QUICK_APPROVE_REPLIES.notAllowed };
  }
  if (report.status !== "submitted") {
    return { reply: QUICK_APPROVE_REPLIES.notEligible };
  }
  // The hard rule: flagged reports are never approvable from chat.
  if (isReportFlagged(report.expenses.map((e) => e.flags))) {
    return { reply: QUICK_APPROVE_REPLIES.flagged };
  }

  const ctx: SessionCtx = {
    userId: actor.userId,
    orgId,
    orgSlug: "",
    role: actor.role,
  };
  const result = await decideReport(
    ctx,
    { reportId: report.id, action: "approve" },
    // belt and braces: decideReport refuses flagged reports under this flag
    { requireUnflagged: true, channel: "whatsapp" }
  );

  if (!result.ok) {
    // Repeat taps land here once the report has moved on — which is exactly
    // what makes the callback idempotent.
    return { reply: result.error || QUICK_APPROVE_REPLIES.notEligible };
  }
  return { reply: QUICK_APPROVE_REPLIES.approved(report.title) };
}

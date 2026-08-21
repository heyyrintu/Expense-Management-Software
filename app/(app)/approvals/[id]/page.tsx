import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CommentThread, type CommentView } from "@/components/comment-thread";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import { requireRole } from "@/lib/auth/guard";
import {
  resolveChain,
  type ChainRule,
} from "@/lib/domain/approval-chain";
import {
  canDecideAtLevel,
  currentSubmissionApprovals,
  pendingLevel,
  type ApprovalRow,
} from "@/lib/domain/approvals";
import { secondApprovalThreshold } from "@/lib/domain/org-settings";
import { scopedDb } from "@/lib/db/scoped";
import { DecisionPanel } from "./decision-panel";

export default async function ApprovalReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireRole("approver");
  const db = scopedDb(ctx.orgId);

  const report = await db.expenseReport.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, approverId: true, departmentId: true },
      },
      approvals: {
        orderBy: { actedAt: "asc" },
        include: { approver: { select: { name: true } } },
      },
      expenses: {
        orderBy: { date: "desc" },
        include: {
          category: { select: { name: true } },
          _count: { select: { receipts: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!report) notFound();

  const commentViews: CommentView[] = report.comments.map(
    (c: { id: string; body: string; createdAt: Date; authorId: string; author: { name: string } }) => ({
      id: c.id,
      authorName: c.author.name,
      body: c.body,
      // Raw timestamp — CommentThread renders it through <DateCell>.
      when: c.createdAt,
      mine: c.authorId === ctx.userId,
    })
  );

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
  const required: 1 | 2 = chain.level2 ? 2 : 1;
  const approvalRows: ApprovalRow[] = report.approvals.map(
    (a: { level: number; action: ApprovalRow["action"]; approverId: string; actedAt: Date }) => ({
      level: a.level,
      action: a.action,
      approverId: a.approverId,
      actedAt: a.actedAt,
    })
  );
  const current = currentSubmissionApprovals(approvalRows, report.submittedAt);
  const level = report.status === "submitted" ? pendingLevel(current, required) : null;
  const decidedLevel1Id =
    current.find((a) => a.level === 1 && a.action === "approved")?.approverId ?? null;
  const canDecide =
    level !== null &&
    canDecideAtLevel({
      actorId: ctx.userId,
      actorRole: ctx.role,
      ownerId: report.user.id,
      responsibleLevel1Id: chain.level1ApproverId,
      decidedLevel1Id,
      level2: chain.level2,
      level,
    });

  type ExpenseRow = (typeof report.expenses)[number] & {
    flags: unknown;
    _count: { receipts: number };
  };

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{report.title}</h1>
            <StatusBadge status={report.status} />
          </div>
          <p className="text-text-tertiary text-sm">
            {report.user.name}
            {report.submittedAt ? (
              <>
                {" · submitted "}
                <DateCell value={report.submittedAt} tone="muted" />
              </>
            ) : null}
            {required === 2 ? ` · needs 2 approvals` : ""}
          </p>
        </div>
        <Amount value={report.total} currency={org.currency} size="display" align="right" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses ({report.expenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2">
            {(report.expenses as ExpenseRow[]).map((e) => {
              const flags = asFlags(e.flags);
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <span className="grid">
                    <span className="font-medium">{e.merchant}</span>
                    <span className="text-text-tertiary">
                      <DateCell value={e.date} /> · {e.category.name} ·{" "}
                      {e._count.receipts} receipt{e._count.receipts === 1 ? "" : "s"}
                      {e.purpose ? ` · ${e.purpose}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <FlagChips flags={flags} />
                    <Amount
                      value={e.amount}
                      currency={e.currency}
                      align="right"
                      converted={
                        e.currency !== org.currency
                          ? { value: e.baseAmount, currency: org.currency }
                          : null
                      }
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {report.approvals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Decision history</CardTitle>
            <CardDescription>All submissions of this report.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {report.approvals.map(
                (a: {
                  id: string;
                  level: number;
                  action: string;
                  reason: string | null;
                  actedAt: Date;
                  approver: { name: string };
                }) => (
                  <li key={a.id} className="flex flex-wrap gap-2">
                    <DateCell value={a.actedAt} tone="muted" />
                    <span className="font-medium">{a.approver.name}</span>
                    <span>
                      {a.action.replace("_", " ")} (level {a.level})
                    </span>
                    {a.reason ? (
                      <span className="text-text-tertiary">— {a.reason}</span>
                    ) : null}
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <CommentThread reportId={report.id} comments={commentViews} />

      {canDecide && level ? (
        <DecisionPanel
          reportId={report.id}
          level={level}
          required={required}
          flagged={(report.expenses as ExpenseRow[]).some(
            (e) => asFlags(e.flags).length > 0
          )}
        />
      ) : (
        <p className="text-text-tertiary text-sm">
          {report.status === "submitted"
            ? "This report isn't awaiting your decision."
            : "This report has already been decided."}
        </p>
      )}
    </section>
  );
}

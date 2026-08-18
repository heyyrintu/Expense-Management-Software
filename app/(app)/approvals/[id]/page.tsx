import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guard";
import {
  canDecideAtLevel,
  currentSubmissionApprovals,
  pendingLevel,
  requiredLevels,
  type ApprovalRow,
} from "@/lib/domain/approvals";
import { secondApprovalThreshold } from "@/lib/domain/org-settings";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
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
      user: { select: { id: true, name: true, approverId: true } },
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
    },
  });
  if (!report) notFound();

  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const threshold = secondApprovalThreshold(org.settings);
  const required = requiredLevels(report.total, threshold);
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
  const level1ApproverId =
    current.find((a) => a.level === 1 && a.action === "approved")?.approverId ?? null;
  const canDecide =
    level !== null &&
    canDecideAtLevel({
      actorId: ctx.userId,
      actorRole: ctx.role,
      ownerId: report.user.id,
      ownerApproverId: report.user.approverId,
      level1ApproverId,
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
          <p className="text-muted-foreground text-sm">
            {report.user.name}
            {report.submittedAt ? ` · submitted ${formatDate(report.submittedAt)}` : ""}
            {required === 2 ? ` · needs 2 approvals` : ""}
          </p>
        </div>
        <span className="text-lg font-semibold">
          {formatMoney(report.total, org.currency)}
        </span>
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
                    <span className="text-muted-foreground">
                      {formatDate(e.date)} · {e.category.name} ·{" "}
                      {e._count.receipts} receipt{e._count.receipts === 1 ? "" : "s"}
                      {e.purpose ? ` · ${e.purpose}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <FlagChips flags={flags} />
                    <span className="font-semibold">
                      {formatMoney(e.amount, e.currency)}
                    </span>
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
                    <span className="text-muted-foreground">{formatDate(a.actedAt)}</span>
                    <span className="font-medium">{a.approver.name}</span>
                    <span>
                      {a.action.replace("_", " ")} (level {a.level})
                    </span>
                    {a.reason ? (
                      <span className="text-muted-foreground">— {a.reason}</span>
                    ) : null}
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
        <p className="text-muted-foreground text-sm">
          {report.status === "submitted"
            ? "This report isn't awaiting your decision."
            : "This report has already been decided."}
        </p>
      )}
    </section>
  );
}

import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guard";
import { approvalQueueFor } from "@/lib/domain/approval-queue";
import { scopedDb } from "@/lib/db/scoped";
import { AdvanceQueue } from "./advance-queue";
import { QueueList } from "./queue-list";

export default async function ApprovalsPage() {
  const ctx = await requireRole("approver");
  const db = scopedDb(ctx.orgId);
  const [org, queue, pendingAdvances] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    approvalQueueFor(db, ctx),
    db.advance.findMany({
      where: { status: "submitted", user: { approverId: ctx.userId } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    }) as Promise<
      Array<{
        id: string;
        amount: number;
        purpose: string;
        tripStart: Date | null;
        tripEnd: Date | null;
        user: { name: string };
      }>
    >,
  ]);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Flagged reports come first — they need a decision bulk approve can't give them."
      />
      <div className="grid gap-4">
      {pendingAdvances.length > 0 ? (
        <AdvanceQueue
          items={pendingAdvances.map((a) => ({
            id: a.id,
            purpose: a.purpose,
            ownerName: a.user.name,
            amount: a.amount,
            currency: org.currency,
            trip:
              a.tripStart && a.tripEnd
                ? `${a.tripStart.toISOString().slice(0, 10)} – ${a.tripEnd.toISOString().slice(0, 10)}`
                : null,
          }))}
        />
      ) : null}

      {/* QueueList owns the empty state now — it also has to show it after the
          last row is optimistically approved, which the server doesn't know
          about yet. */}
      <QueueList
        items={queue.map((q) => ({
          ...q,
          submittedAt: q.submittedAt?.toISOString() ?? null,
        }))}
        currency={org.currency}
      />
      </div>
    </>
  );
}

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guard";
import { approvalQueueFor } from "@/lib/domain/approval-queue";
import { scopedDb } from "@/lib/db/scoped";
import { formatMoney } from "@/lib/money";
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
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-muted-foreground text-sm">
          Reports waiting on your decision. Unflagged reports can be approved
          in bulk.
        </p>
      </div>
      {pendingAdvances.length > 0 ? (
        <AdvanceQueue
          items={pendingAdvances.map((a) => ({
            id: a.id,
            purpose: a.purpose,
            ownerName: a.user.name,
            amount: formatMoney(a.amount, org.currency),
            trip:
              a.tripStart && a.tripEnd
                ? `${a.tripStart.toISOString().slice(0, 10)} – ${a.tripEnd.toISOString().slice(0, 10)}`
                : null,
          }))}
        />
      ) : null}

      {queue.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>All clear</CardTitle>
            <CardDescription>Nothing is waiting for your approval.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <QueueList
          items={queue.map((q) => ({
            ...q,
            submittedAt: q.submittedAt?.toISOString() ?? null,
          }))}
          currency={org.currency}
        />
      )}
    </section>
  );
}

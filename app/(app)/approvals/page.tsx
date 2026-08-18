import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guard";
import { approvalQueueFor } from "@/lib/domain/approval-queue";
import { scopedDb } from "@/lib/db/scoped";
import { QueueList } from "./queue-list";

export default async function ApprovalsPage() {
  const ctx = await requireRole("approver");
  const db = scopedDb(ctx.orgId);
  const [org, queue] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    approvalQueueFor(db, ctx),
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

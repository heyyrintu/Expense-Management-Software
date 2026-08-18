import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ReimburseQueue } from "./reimburse-queue";

type ApprovedRow = {
  id: string;
  title: string;
  total: number;
  submittedAt: Date | null;
  user: { name: string };
  _count: { expenses: number };
};

type ReimbursementRow = {
  id: string;
  amount: number;
  paidAt: Date;
  reference: string;
  report: { title: string; user: { name: string } };
  paidBy: { name: string };
};

export default async function FinancePage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const [org, approved, recent] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.expenseReport.findMany({
      where: { status: "approved" },
      orderBy: { submittedAt: "asc" },
      take: 200,
      include: {
        user: { select: { name: true } },
        _count: { select: { expenses: true } },
      },
    }) as Promise<ApprovedRow[]>,
    db.reimbursement.findMany({
      orderBy: { paidAt: "desc" },
      take: 20,
      include: {
        report: { select: { title: true, user: { select: { name: true } } } },
        paidBy: { select: { name: true } },
      },
    }) as Promise<ReimbursementRow[]>,
  ]);

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Finance</h1>
        <p className="text-muted-foreground text-sm">
          Approved reports ready for reimbursement.
        </p>
      </div>

      {approved.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>Queue is empty</CardTitle>
            <CardDescription>
              Approved reports appear here for payment.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ReimburseQueue
          items={approved.map((r) => ({
            id: r.id,
            title: r.title,
            total: r.total,
            ownerName: r.user.name,
            expenseCount: r._count.expenses,
            submitted: r.submittedAt ? formatDate(r.submittedAt) : "",
          }))}
          currency={org.currency}
        />
      )}

      {recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recently reimbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-2">
                  <span className="text-muted-foreground">{formatDate(r.paidAt)}</span>
                  <span className="font-medium">{r.report.title}</span>
                  <span>({r.report.user.name})</span>
                  <span className="font-semibold">
                    {formatMoney(r.amount, org.currency)}
                  </span>
                  <span className="text-muted-foreground">
                    ref {r.reference} · by {r.paidBy.name}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

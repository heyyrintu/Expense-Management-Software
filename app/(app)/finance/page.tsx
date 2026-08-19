import { Amount } from "@/components/ui/amount";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateCell } from "@/components/ui/date-cell";
import { requireRole } from "@/lib/auth/guard";
import { outstandingBalance } from "@/lib/domain/reimbursement";
import { scopedDb } from "@/lib/db/scoped";
import { ReimburseQueue } from "./reimburse-queue";

type PayableRow = {
  id: string;
  title: string;
  total: number;
  status: string;
  submittedAt: Date | null;
  user: { name: string };
  reimbursements: { amountPaid: number }[];
  _count: { expenses: number };
};

type PaymentRow = {
  id: string;
  amountPaid: number;
  method: string;
  paidAt: Date;
  reference: string;
  report: { title: string; user: { name: string } };
  paidBy: { name: string };
};

export default async function FinancePage() {
  const ctx = await requireRole("finance_admin");
  const db = scopedDb(ctx.orgId);
  const [org, payable, recent] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.expenseReport.findMany({
      where: { status: { in: ["approved", "partially_reimbursed"] } },
      orderBy: { submittedAt: "asc" },
      take: 200,
      include: {
        user: { select: { name: true } },
        reimbursements: { select: { amountPaid: true } },
        _count: { select: { expenses: true } },
      },
    }) as Promise<PayableRow[]>,
    db.reimbursement.findMany({
      orderBy: { paidAt: "desc" },
      take: 20,
      include: {
        report: { select: { title: true, user: { select: { name: true } } } },
        paidBy: { select: { name: true } },
      },
    }) as Promise<PaymentRow[]>,
  ]);

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Finance</h1>
        <p className="text-muted-foreground text-sm">
          Approved and partially paid reports awaiting payment.
        </p>
      </div>

      {payable.length === 0 ? (
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
          items={payable.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            balance: outstandingBalance(r.total, r.reimbursements),
            total: r.total,
            ownerName: r.user.name,
            expenseCount: r._count.expenses,
            submittedAt: r.submittedAt,
          }))}
          currency={org.currency}
        />
      )}

      {recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-2">
                  <DateCell value={r.paidAt} tone="muted" />
                  <span className="font-medium">{r.report.title}</span>
                  <span>({r.report.user.name})</span>
                  <Amount value={r.amountPaid} currency={org.currency} />
                  <span className="text-muted-foreground">
                    {r.method.replace("_", " ")} · ref {r.reference} · by {r.paidBy.name}
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

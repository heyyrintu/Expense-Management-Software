import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

type ExpenseRow = {
  id: string;
  amount: number;
  baseAmount: number;
  currency: string;
  date: Date;
  merchant: string;
  status: string;
  flags: unknown;
  category: { name: string };
};

export default async function ExpensesPage() {
  const ctx = await requireSession();
  const org = await scopedDb(ctx.orgId).organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
  });
  const expenses: ExpenseRow[] = await scopedDb(ctx.orgId).expense.findMany({
    where: { userId: ctx.userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { category: { select: { name: true } } },
  });

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">My expenses</h1>
          <p className="text-muted-foreground text-sm">
            Draft expenses can be edited until they join a submitted report.
          </p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">Add expense</Link>
        </Button>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No expenses yet</CardTitle>
            <CardDescription>
              Capture your first expense — it only takes a minute.
            </CardDescription>
            <Button asChild className="mt-2 w-fit self-center">
              <Link href="/expenses/new">Add your first expense</Link>
            </Button>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* mobile cards */}
          <ul className="grid gap-3 md:hidden">
            {expenses.map((e) => (
              <li key={e.id}>
                <Link href={`/expenses/${e.id}`}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="truncate">{e.merchant}</CardTitle>
                        <span className="grid text-right">
                          <span className="font-semibold whitespace-nowrap">
                            {formatMoney(e.amount, e.currency)}
                          </span>
                          {e.currency !== org.currency ? (
                            <span className="text-muted-foreground text-xs">
                              → {formatMoney(e.baseAmount, org.currency)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        {formatDate(e.date)} · {e.category.name}
                        <StatusBadge status={e.status} />
                        <FlagChips flags={asFlags(e.flags)} />
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          {/* desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Merchant</th>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="p-3 font-medium">{e.merchant}</td>
                    <td className="p-3">{e.category.name}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {formatMoney(e.amount, e.currency)}
                      {e.currency !== org.currency ? (
                        <span className="text-muted-foreground block text-xs">
                          → {formatMoney(e.baseAmount, org.currency)}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <span className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={e.status} />
                        <FlagChips flags={asFlags(e.flags)} />
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/expenses/${e.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

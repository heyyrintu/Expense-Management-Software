import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { resolveActing } from "@/lib/auth/acting";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { ExpensesTable, type ExpenseTableRow } from "./expenses-table";

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
  const acting = await resolveActing(ctx);
  const org = await scopedDb(ctx.orgId).organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
  });
  // Unchanged by D1.2 — the table pages in the browser rather than the query
  // moving to the server, because a design task doesn't change queries.
  const expenses: ExpenseRow[] = await scopedDb(ctx.orgId).expense.findMany({
    where: { userId: acting.effectiveUserId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { category: { select: { name: true } } },
  });

  // Dates cross into a client component, so they travel as ISO strings and
  // <DateCell> parses them back — never as pre-formatted display text (D1.1).
  const rows: ExpenseTableRow[] = expenses.map((e) => ({
    id: e.id,
    amount: e.amount,
    baseAmount: e.baseAmount,
    currency: e.currency,
    date: e.date.toISOString(),
    merchant: e.merchant,
    status: e.status,
    category: e.category.name,
    flags: e.flags,
  }));

  return (
    <>
      <PageHeader
        title="My expenses"
        description="Draft expenses can be edited until they join a submitted report."
        action={
          <>
            <Button asChild variant="secondary">
              <Link href="/recurring">Recurring</Link>
            </Button>
            <Button asChild>
              <Link href="/expenses/new">Add expense</Link>
            </Button>
          </>
        }
      />
      <ExpensesTable rows={rows} orgCurrency={org.currency} />
    </>
  );
}

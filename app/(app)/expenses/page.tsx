import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { resolveActing } from "@/lib/auth/acting";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { applyExpenseFilters } from "@/lib/domain/expense-query";
import { parseExpenseFilters } from "@/lib/schemas/expense-filters";
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

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const acting = await resolveActing(ctx);
  const db = scopedDb(ctx.orgId);

  // D1.3: filters come from the URL, so a filtered view survives refresh and
  // can be shared. Anything unparseable is dropped rather than throwing — a
  // truncated link degrades to a wider list, never to an error page.
  const filters = parseExpenseFilters(await searchParams);

  const [org, categories, projects, expenses] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) as Promise<
      Array<{ id: string; name: string }>
    >,
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) as Promise<
      Array<{ id: string; name: string }>
    >,
    // Scope stays pinned to the acting user; applyExpenseFilters ANDs the
    // chosen filters onto it, so a filter can only narrow this list and never
    // reach another user's expenses. See lib/domain/expense-query.ts.
    db.expense.findMany({
      where: applyExpenseFilters({ userId: acting.effectiveUserId }, filters),
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { category: { select: { name: true } } },
    }) as Promise<ExpenseRow[]>,
  ]);

  // Dates cross into a client component as ISO strings; <DateCell> parses
  // them back. Never pre-formatted display text (D1.1).
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
      <ExpensesTable
        rows={rows}
        orgCurrency={org.currency}
        categories={categories}
        projects={projects}
      />
    </>
  );
}

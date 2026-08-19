import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { resolveActing } from "@/lib/auth/acting";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { applyExpenseFilters } from "@/lib/domain/expense-query";
import {
  buildExpenseStats,
  parsePageIndex,
  type StatusGroup,
} from "@/lib/domain/expense-stats";
import { parseExpenseFilters } from "@/lib/schemas/expense-filters";
import type { OpenReport } from "./add-to-report";
import { EXPENSE_PAGE_SIZE, ExpensesTable, type ExpenseTableRow } from "./expenses-table";

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

  const raw = await searchParams;
  // Filters come from the URL, so a filtered view survives refresh and can be
  // shared. Anything unparseable is dropped rather than throwing.
  const filters = parseExpenseFilters(raw);
  const pageIndex = parsePageIndex(raw.page);

  // ONE where-clause feeds the list, the count and the KPI strip. That is
  // what makes §7.4 hold — the cards and the rows cannot disagree, because
  // they are the same query narrowed differently. Scope stays pinned to the
  // acting user; applyExpenseFilters ANDs the filters onto it so a filter can
  // only ever narrow (see lib/domain/expense-query.ts).
  const where = applyExpenseFilters({ userId: acting.effectiveUserId }, filters);

  const [org, categories, projects, totalRows, statusGroups, expenses, openReportRows] =
    await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) as Promise<
      Array<{ id: string; name: string }>
    >,
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) as Promise<
      Array<{ id: string; name: string }>
    >,
    db.expense.count({ where }) as Promise<number>,
    db.expense.groupBy({
      by: ["status"],
      where,
      _sum: { baseAmount: true },
      _count: { _all: true },
    }) as Promise<StatusGroup[]>,
    // Server-paginated (D1.2 built the mode for exactly this). The previous
    // flat take: 200 would have made the KPI cards lie the moment somebody
    // had more than 200 matching expenses: the cards counted everything, the
    // table showed the first 200.
    db.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: pageIndex * EXPENSE_PAGE_SIZE,
      take: EXPENSE_PAGE_SIZE,
      include: { category: { select: { name: true } } },
    }) as Promise<ExpenseRow[]>,
    // Reports the bulk bar can attach to: the acting user's own, and only
    // those a report can still accept rows into (D2.3). A submitted report
    // in this list would offer an action the action layer rightly refuses.
    db.expenseReport.findMany({
      where: {
        userId: acting.effectiveUserId,
        status: { in: ["draft", "sent_back"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, _count: { select: { expenses: true } } },
    }) as Promise<Array<{ id: string; title: string; _count: { expenses: number } }>>,
  ]);

  const stats = buildExpenseStats(statusGroups, filters);
  const openReports: OpenReport[] = openReportRows.map((r) => ({
    id: r.id,
    title: r.title,
    expenseCount: r._count.expenses,
  }));

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
        stats={stats}
        totalRows={totalRows}
        pageIndex={pageIndex}
        openReports={openReports}
      />
    </>
  );
}

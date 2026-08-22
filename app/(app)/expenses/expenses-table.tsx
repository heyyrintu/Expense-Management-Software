"use client";

// The expense list — the reference implementation for both the shared
// DataTable (D1.2) and the shared FilterBar (D1.3).
//
// FILTERING IS SERVER-SIDE. The filter state lives in the URL, the page reads
// it, and the query narrows. Filtering the 200 rows already in the browser
// would have been less work and would have quietly lied to anyone with more
// than 200 expenses — "no results" when the match was on page three.
//
// PAGING IS SERVER-SIDE too, as of D1.4. It had to become so: the KPI cards
// aggregate the whole filtered set, and a table capped at the first 200 rows
// would have made the cards disagree with the list they link to the moment
// anyone crossed the cap — which is exactly what §7.4 forbids.
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DataTable, selectionColumn } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { FilterBar, useUrlFilters } from "@/components/filters";
import type { FilterBarConfig } from "@/components/filters";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { StatCard } from "@/components/ui/stat-card";
import { countHint, type ExpenseStat } from "@/lib/domain/expense-stats";
import type { ExpenseViewScope } from "@/lib/domain/expense-scope";
import { statusEntry } from "@/lib/design/status";
import {
  EMPTY_EXPENSE_FILTERS,
  EXPENSE_STATUSES,
  hasActiveFilters,
} from "@/lib/schemas/expense-filters";
import { cn } from "@/lib/utils";
import { AddToReport, type OpenReport } from "./add-to-report";
import { EXPENSE_PAGE_SIZE } from "./constants";
import { ExportButton } from "./export-button";

/** Serialisable row — this crosses the server/client boundary. */
export type ExpenseTableRow = {
  id: string;
  amount: number;
  baseAmount: number;
  currency: string;
  date: string;
  merchant: string;
  status: string;
  category: string;
  flags: unknown;
};

/** Query keys carried through a filter change. */
const PRESERVED_PARAMS = ["scope"] as const;

export function ExpensesTable({
  rows,
  orgCurrency,
  categories,
  projects,
  stats,
  totalRows,
  pageIndex,
  openReports,
  scope,
  canAttach = true,
}: {
  rows: ExpenseTableRow[];
  orgCurrency: string;
  categories: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  stats: ExpenseStat[];
  totalRows: number;
  pageIndex: number;
  openReports: OpenReport[];
  /**
   * The scope the SERVER resolved (D3.3), passed down so the export link
   * carries the width the reader actually has rather than the one the URL
   * asked for. Reading `?scope=` here instead would let an employee's
   * `?scope=org` reach the export route as a request to widen.
   */
  scope: ExpenseViewScope;
  /**
   * False in the team and org views (D3.3). A report belongs to one person,
   * so offering "Add to report" over someone else's rows would put a button
   * on screen whose only outcome is a server refusal — UI that lies about
   * what it can do is worse than UI that isn't there.
   */
  canAttach?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // `scope` is not a filter but must survive one (D3.3/D4.1): changing a
  // date range in the org-wide view must not throw the reader back to
  // their own rows.
  const { filters, setFilters, pending } = useUrlFilters(PRESERVED_PARAMS);

  // Page lives in the URL beside the filters, so a paged view is as
  // shareable as a filtered one. It is NOT part of the filter schema: a page
  // number is a position, not a predicate, and letting it into the filters
  // would put it on every KPI href.
  const goToPage = React.useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams);
      if (next <= 0) params.delete("page");
      else params.set("page", String(next + 1));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const filterConfig = React.useMemo<FilterBarConfig>(
    () => ({
      search: { placeholder: "Search merchant" },
      dateRange: true,
      facets: [
        {
          key: "status",
          label: "Status",
          // Labels come from the status map, so a chip reads "Sent back"
          // rather than "sent_back" and matches the badge beside it.
          options: EXPENSE_STATUSES.map((s) => ({
            value: s,
            label: statusEntry(s).label,
          })),
        },
        {
          key: "categoryId",
          label: "Category",
          options: categories.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          key: "projectId",
          label: "Project",
          options: projects.map((p) => ({ value: p.id, label: p.name })),
        },
      ],
    }),
    [categories, projects]
  );

  const columns = React.useMemo<DataTableColumn<ExpenseTableRow>[]>(
    () => [
      selectionColumn<ExpenseTableRow>({
        rowLabel: (row) => `Select expense from ${row.merchant}`,
      }),
      {
        accessorKey: "date",
        header: "Date",
        meta: { skeletonWidth: "w-24" },
        cell: ({ row }) => <DateCell value={row.original.date} />,
      },
      {
        accessorKey: "merchant",
        header: "Merchant",
        meta: { skeletonWidth: "w-32" },
        cell: ({ row }) => (
          <span className="text-text-primary font-medium">{row.original.merchant}</span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        meta: { skeletonWidth: "w-20" },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        // Right-aligned and tabular (§5.3) — the only alignment money takes.
        meta: { align: "right", skeletonWidth: "w-24" },
        cell: ({ row }) => (
          <Amount
            value={row.original.amount}
            currency={row.original.currency}
            align="right"
            converted={
              row.original.currency !== orgCurrency
                ? { value: row.original.baseAmount, currency: orgCurrency }
                : null
            }
          />
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        meta: { skeletonWidth: "w-20" },
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-1">
            <StatusBadge status={row.original.status} />
            <FlagChips flags={asFlags(row.original.flags)} />
          </span>
        ),
      },
    ],
    [orgCurrency]
  );

  return (
    // While the server re-runs the query the list DIMS rather than being
    // replaced by skeletons: swapping in placeholders on every keystroke
    // would destroy the context the reader is filtering against. Opacity
    // only, so reduced motion loses nothing.
    <div
      aria-busy={pending || undefined}
      className={cn(
        "grid gap-4 transition-opacity duration-fast ease-out",
        pending && "opacity-60"
      )}
    >
      {/* Every card totals the SAME filtered query the table below runs, and
          links to that query narrowed to one status — so the figure and the
          rows it opens can never drift (§7.4). */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={stat.total}
            currency={orgCurrency}
            hint={countHint(stat.count)}
            href={stat.key === "total" ? undefined : stat.href}
          />
        ))}
      </div>

      <DataTable
      label="My expenses"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      enableSelection
      pagination={{
        mode: "server",
        pageIndex,
        pageSize: EXPENSE_PAGE_SIZE,
        totalRows,
        onPageChange: goToPage,
      }}
      onRowClick={(row) => router.push(`/expenses/${row.id}`)}
      empty={
        // Two different situations, and conflating them is a classic
        // filter bug: "you have nothing" versus "your filters match
        // nothing". The second needs a way back, not an invitation to
        // create something.
        hasActiveFilters(filters)
          ? {
              headline: "No expenses match these filters",
              description: "Try a wider date range, or clear a filter.",
              action: (
                <Button variant="secondary" onClick={() => setFilters(EMPTY_EXPENSE_FILTERS)}>
                  Clear filters
                </Button>
              ),
            }
          : {
              headline: "No expenses yet",
              description: "Capture your first expense — it only takes a minute.",
              action: (
                <Button onClick={() => router.push("/expenses/new")}>
                  Add your first expense
                </Button>
              ),
            }
      }
      toolbar={
        // Filters left, export right. The export is deliberately BESIDE the
        // filters rather than in the page header: it exports the filtered
        // set, and putting it next to the controls that define that set is
        // what makes "export what I'm looking at" legible without a label
        // explaining it.
        <div className="flex flex-wrap items-start justify-between gap-3">
          <FilterBar config={filterConfig} value={filters} onChange={setFilters} />
          <ExportButton filters={filters} scope={scope} totalRows={totalRows} />
        </div>
      }
      renderCard={(row) => (
        <button
          type="button"
          onClick={() => router.push(`/expenses/${row.original.id}`)}
          className="grid w-full gap-1 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
        >
          {/* Primary line: merchant and amount (§6.1). Everything else is meta. */}
          <span className="flex items-start justify-between gap-3">
            <span className="text-text-primary truncate font-medium">{row.original.merchant}</span>
            <Amount
              value={row.original.amount}
              currency={row.original.currency}
              align="right"
              converted={
                row.original.currency !== orgCurrency
                  ? { value: row.original.baseAmount, currency: orgCurrency }
                  : null
              }
            />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <DateCell value={row.original.date} />
            <span className="text-meta text-text-tertiary">{row.original.category}</span>
            <StatusBadge status={row.original.status} />
            <FlagChips flags={asFlags(row.original.flags)} />
          </span>
        </button>
      )}
      renderBulkActions={
        !canAttach
          ? undefined
          : ({ rows: selected, clear }) => (
        // The action D1.2's bar was built for. Only DRAFT expenses can join a
        // report, so the button counts what is actually attachable rather
        // than what is ticked — and says so, instead of failing per row after
        // the reader has committed.
        <AddToReport
          expenseIds={selected
            .filter((row) => row.original.status === "draft")
            .map((row) => row.original.id)}
          skippedCount={selected.filter((row) => row.original.status !== "draft").length}
          reports={openReports}
          onDone={clear}
        />
            )
      }
      />
    </div>
  );
}

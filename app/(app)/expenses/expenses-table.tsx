"use client";

// The expense list — the reference implementation for both the shared
// DataTable (D1.2) and the shared FilterBar (D1.3).
//
// FILTERING IS SERVER-SIDE. The filter state lives in the URL, the page reads
// it, and the query narrows. Filtering the 200 rows already in the browser
// would have been less work and would have quietly lied to anyone with more
// than 200 expenses — "no results" when the match was on page three.
//
// Paging stays client-side: the query still takes 200 in one go. DataTable
// supports `pagination={{ mode: "server", … }}` for a screen whose query
// paginates, which this one should become once the row count justifies it.
import * as React from "react";
import { useRouter } from "next/navigation";

import { DataTable, selectionColumn } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { FilterBar, useUrlFilters } from "@/components/filters";
import type { FilterBarConfig } from "@/components/filters";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { statusEntry } from "@/lib/design/status";
import {
  EMPTY_EXPENSE_FILTERS,
  EXPENSE_STATUSES,
  hasActiveFilters,
} from "@/lib/schemas/expense-filters";
import { cn } from "@/lib/utils";

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

export function ExpensesTable({
  rows,
  orgCurrency,
  categories,
  projects,
}: {
  rows: ExpenseTableRow[];
  orgCurrency: string;
  categories: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { filters, setFilters, pending } = useUrlFilters();

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
        "transition-opacity duration-fast ease-out",
        pending && "opacity-60"
      )}
    >
      <DataTable
      label="My expenses"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      enableSelection
      pagination={{ mode: "client" }}
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
        <FilterBar config={filterConfig} value={filters} onChange={setFilters} />
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
      renderBulkActions={() => (
        // "Add to report" (§7.2) needs the draft-report picker that D2.3
        // builds, and the read to populate it — which would be a query change.
        // The bar, its animation and its selection state ship here; the
        // action it will carry ships with the report builder.
        <span className="text-meta text-text-tertiary">
          Add to report arrives with the report builder
        </span>
      )}
      />
    </div>
  );
}

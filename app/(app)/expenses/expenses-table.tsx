"use client";

// The expense list, on the shared DataTable (D1.2) — the reference
// implementation every later table copies.
//
// Presentation only. The page's query is untouched: it still reads up to 200
// of the acting user's expenses in one go, so this pages in the browser.
// DataTable also supports `pagination={{ mode: "server", … }}`, which is what
// a screen whose query paginates should pass — see the note on the
// `pagination` prop. Switching this screen to a server-paged query is a
// query change, and D1.2 is a presentation task.
import * as React from "react";
import { useRouter } from "next/navigation";

import { DataTable, selectionColumn } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";

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
}: {
  rows: ExpenseTableRow[];
  orgCurrency: string;
}) {
  const router = useRouter();

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
    <DataTable
      label="My expenses"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      enableSelection
      pagination={{ mode: "client" }}
      onRowClick={(row) => router.push(`/expenses/${row.id}`)}
      empty={{
        headline: "No expenses yet",
        description: "Capture your first expense — it only takes a minute.",
        action: (
          <Button onClick={() => router.push("/expenses/new")}>Add your first expense</Button>
        ),
      }}
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
  );
}

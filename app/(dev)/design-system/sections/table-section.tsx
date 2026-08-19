"use client";

// DataTable (D1.2) — DESIGN-PRD §6.1.
//
// The controls below are the point: a table's hard states are the ones you
// can't reach by looking at a screen with data in it. Loading, empty, a
// selection, a second page — each is one click away here, and each is the
// real component rather than a picture of it.
import * as React from "react";

import { DataTable, selectionColumn, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { Block, Group, Row } from "./shared";

type DemoRow = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  baseAmount: number;
  status: string;
};

const MERCHANTS = [
  ["IndiGo 6E-2043", "Travel", 1450000, "INR"],
  ["Blue Tokai", "Meals", 45000, "INR"],
  ["Uber", "Travel", 34050, "INR"],
  ["AWS", "Software", 24000, "USD"],
  ["Taj Bengal", "Lodging", 10820000, "INR"],
  ["Refund — Taj", "Lodging", -320000, "INR"],
  ["Zoom", "Software", 149900, "INR"],
  ["Chai Point", "Meals", 12000, "INR"],
] as const;

const STATUSES = ["draft", "submitted", "approved", "rejected", "sent_back", "reimbursed"];

/** Deterministic, so the specimen looks the same on every render. */
const ROWS: DemoRow[] = Array.from({ length: 62 }, (_, i) => {
  const [merchant, category, amount, currency] = MERCHANTS[i % MERCHANTS.length];
  return {
    id: `row-${i}`,
    date: new Date(Date.UTC(2026, 7, 19 - (i % 28))).toISOString(),
    merchant: merchant as string,
    category: category as string,
    amount: amount as number,
    currency: currency as string,
    baseAmount: currency === "USD" ? (amount as number) * 83 : (amount as number),
    status: STATUSES[i % STATUSES.length],
  };
});

export function TableSection() {
  const [loading, setLoading] = React.useState(false);
  const [emptyMode, setEmptyMode] = React.useState(false);

  const columns = React.useMemo<DataTableColumn<DemoRow>[]>(
    () => [
      selectionColumn<DemoRow>({ rowLabel: (r) => `Select expense from ${r.merchant}` }),
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
      { accessorKey: "category", header: "Category", meta: { skeletonWidth: "w-20" } },
      {
        accessorKey: "amount",
        header: "Amount",
        meta: { align: "right", skeletonWidth: "w-24" },
        cell: ({ row }) => (
          <Amount
            value={row.original.amount}
            currency={row.original.currency}
            align="right"
            converted={
              row.original.currency !== "INR"
                ? { value: row.original.baseAmount, currency: "INR" }
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
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    []
  );

  return (
    <Group
      id="table"
      eyebrow="§6.1 · §7.2"
      title="DataTable"
      description="One table for every list in the product. Sticky header, 48px rows, sortable columns, a column menu, pagination past 50 rows, row selection with a floating bar, and a stacked-card rendering under md that reads the same row model rather than being a second component."
    >
      <Block
        title="The states"
        description="Toggle between them. The skeleton rows take their widths from each column's own meta, so nothing shifts when the data lands — switch to Loading and watch the column edges hold."
      >
        <Row label="State">
          <Button
            size="sm"
            variant={!loading && !emptyMode ? "primary" : "secondary"}
            onClick={() => {
              setLoading(false);
              setEmptyMode(false);
            }}
          >
            Loaded
          </Button>
          <Button
            size="sm"
            variant={loading ? "primary" : "secondary"}
            onClick={() => {
              setLoading(true);
              setEmptyMode(false);
            }}
          >
            Loading
          </Button>
          <Button
            size="sm"
            variant={emptyMode ? "primary" : "secondary"}
            onClick={() => {
              setEmptyMode(true);
              setLoading(false);
            }}
          >
            Empty
          </Button>
        </Row>

        <DataTable
          label="Design system table specimen"
          columns={columns}
          data={emptyMode ? [] : ROWS}
          getRowId={(row) => row.id}
          loading={loading}
          enableSelection
          pagination={{ mode: "client" }}
          empty={{
            headline: "No expenses yet",
            description: "Capture one from a receipt, or add the details yourself.",
            action: <Button>Add expense</Button>,
          }}
          renderCard={(row) => (
            <span className="grid gap-1 p-4">
              <span className="flex items-start justify-between gap-3">
                <span className="text-text-primary truncate font-medium">
                  {row.original.merchant}
                </span>
                <Amount
                  value={row.original.amount}
                  currency={row.original.currency}
                  align="right"
                />
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <DateCell value={row.original.date} />
                <span className="text-meta text-text-tertiary">{row.original.category}</span>
                <StatusBadge status={row.original.status} />
              </span>
            </span>
          )}
          renderBulkActions={() => (
            <>
              <Button size="sm" variant="secondary">
                Export
              </Button>
              <Button size="sm">Add to report</Button>
            </>
          )}
        />

        <p className="text-meta text-text-tertiary">
          62 rows, so pagination appears at the 50-row threshold. Tick a row to
          raise the bulk bar — it slides up from the bottom edge in 200ms
          ease-out, and the selected row takes accent-subtle with a 2px accent
          bar drawn as an inset shadow, so the cells don&apos;t shift sideways.
        </p>
      </Block>

      <Block
        title="Below md"
        description="The same rows as stacked cards: merchant and amount on the primary line, date, category and status as meta beneath. Narrow the window past 768px to swap — the table above is the same component."
      >
        <p className="text-meta text-text-tertiary">
          The cards read the same TanStack row model as the table, so sorting,
          paging and selection carry across the breakpoint instead of resetting.
        </p>
      </Block>
    </Group>
  );
}

"use client";

// DataTable (D1.2) — DESIGN-PRD §6.1.
//
// Sticky header, 48px rows, hover bg-subtle, selected accent-subtle with a
// 2px left accent bar, sort indicators, column visibility, pagination past
// 50 rows, shape-matched row skeletons, an integrated EmptyState, row
// selection with a floating bulk bar, and a stacked-card variant under md.
//
// TWO RENDERINGS, ONE SOURCE. The mobile cards are not a second component
// fed by a second data path — they read the same TanStack row model as the
// table, so sorting, pagination and selection apply identically at every
// width. A card list built separately is a card list that drifts.
//
// TanStack v8 deliberately: v9's plugin API is a redesign the ecosystem
// hasn't documented yet, and four later milestones build on this component.
import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BulkActionBar } from "./bulk-action-bar";
import { ColumnVisibilityMenu } from "./column-visibility";
import type { BulkActionContext, DataTableColumn, DataTablePagination } from "./types";

/** §6.1: server pagination past 50 rows. Also the client page size. */
export const DEFAULT_PAGE_SIZE = 50;

export type DataTableProps<TData> = {
  columns: DataTableColumn<TData>[];
  data: TData[];
  /** Stable row id — required for selection to survive sorting and paging. */
  getRowId: (row: TData) => string;

  /** Swaps the body for shape-matched skeleton rows. */
  loading?: boolean;
  /** Rows rendered while loading. Match the usual page length, not the max. */
  skeletonRows?: number;

  /** Shown instead of the table when there are no rows and none are loading. */
  empty?: {
    headline: string;
    description?: string;
    action?: React.ReactNode;
    icon?: React.ReactNode;
  };

  /** Omit for no pagination; "client" pages in the browser. */
  pagination?: DataTablePagination;

  /** Enables the checkbox column and the floating bulk bar. */
  enableSelection?: boolean;
  renderBulkActions?: (ctx: BulkActionContext<TData>) => React.ReactNode;

  /** Rendered in the toolbar, left of the column menu — filters live here. */
  toolbar?: React.ReactNode;
  /** Hides the column-visibility menu when a screen has nothing worth hiding. */
  enableColumnVisibility?: boolean;

  /** Row click target. Makes the whole row (and card) activate. */
  onRowClick?: (row: TData) => void;

  /**
   * Per-row emphasis (D4.3) — an overdue complaint, a flagged import.
   *
   * Returns classes, and they must not change the row's BOX. Use the inset
   * shadow utilities (`flagged-edge`, `overdue-edge`) rather than a border:
   * a border would shift every cell sideways the moment a row qualifies, so
   * the table would jitter as ages tick over.
   */
  rowClassName?: (row: TData) => string | undefined;

  /** Renders one mobile card. Falls back to the table when omitted. */
  renderCard?: (row: Row<TData>) => React.ReactNode;

  /** Accessible name for the table. */
  label: string;
  className?: string;
};

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  loading = false,
  skeletonRows = 8,
  empty,
  pagination,
  enableSelection = false,
  renderBulkActions,
  toolbar,
  enableColumnVisibility = true,
  onRowClick,
  rowClassName,
  renderCard,
  label,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const serverPaged = pagination?.mode === "server";
  const pageSize =
    pagination?.mode === "server"
      ? pagination.pageSize
      : (pagination?.pageSize ?? DEFAULT_PAGE_SIZE);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
      ...(serverPaged
        ? { pagination: { pageIndex: pagination.pageIndex, pageSize } }
        : {}),
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection as OnChangeFn<RowSelectionState>,
    onColumnVisibilityChange: setColumnVisibility,
    enableRowSelection: enableSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Server mode: the parent already sliced the page, so TanStack must not
    // slice it again. manualPagination tells it the rows it has ARE the page.
    ...(serverPaged
      ? {
          manualPagination: true,
          pageCount: Math.max(1, Math.ceil(pagination.totalRows / pageSize)),
        }
      : pagination
        ? { getPaginationRowModel: getPaginationRowModel() }
        : {}),
    initialState: pagination && !serverPaged ? { pagination: { pageSize } } : undefined,
  });

  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().rows;
  const visibleLeafColumns = table.getVisibleLeafColumns();

  const showEmpty = !loading && rows.length === 0 && empty;

  return (
    <div className={cn("grid gap-3", className)}>
      {(toolbar || enableColumnVisibility) && !showEmpty ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbar}</div>
          {enableColumnVisibility ? (
            // Hidden under md: the card variant doesn't have columns to hide.
            <span className="hidden md:inline-flex">
              <ColumnVisibilityMenu table={table} />
            </span>
          ) : null}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="border-line bg-bg-surface rounded-lg border">
          <EmptyState
            icon={empty.icon}
            headline={empty.headline}
            description={empty.description}
            action={empty.action}
          />
        </div>
      ) : (
        <>
          {/* ---- Desktop table ---- */}
          <div
            className={cn(
              "border-line bg-bg-surface overflow-x-auto rounded-lg border",
              renderCard ? "hidden md:block" : "block"
            )}
          >
            <table className="w-full border-collapse">
              <caption className="sr-only">{label}</caption>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta;
                      const sortable = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          // Sticky on the cells, not the row: <thead
                          // position:sticky> is still uneven across browsers.
                          // top-0, NOT top-topbar: the overflow-x-auto wrapper
                          // is the nearest scroll container, so sticky offsets
                          // resolve against IT — a topbar-height offset shoves
                          // the header down INTO the body, covering the first
                          // row (it hid the entire table when only one row
                          // matched). The ledger table is the same pattern.
                          className={cn(
                            "border-line bg-bg-subtle text-label text-text-secondary",
                            "sticky top-0 z-10 border-b px-4 py-2 font-medium",
                            meta?.align === "right" ? "text-right" : "text-left"
                          )}
                          aria-sort={
                            !sortable
                              ? undefined
                              : sorted === "asc"
                                ? "ascending"
                                : sorted === "desc"
                                  ? "descending"
                                  : "none"
                          }
                        >
                          {header.isPlaceholder ? null : sortable ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className={cn(
                                "hover:text-text-primary inline-flex items-center gap-1 rounded-sm",
                                "transition-colors duration-instant ease-out",
                                "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                                meta?.align === "right" && "flex-row-reverse"
                              )}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <SortIcon direction={sorted} />
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>

              <tbody>
                {loading
                  ? Array.from({ length: skeletonRows }, (_, i) => (
                      <tr key={`skeleton-${i}`} className="border-line h-row border-b">
                        {visibleLeafColumns.map((column) => {
                          const meta = column.columnDef.meta;
                          return (
                            <td key={column.id} className="px-4">
                              <span
                                className={cn(
                                  "flex",
                                  meta?.align === "right" ? "justify-end" : "justify-start"
                                )}
                              >
                                {/* Width comes from the column's own meta, so
                                    the placeholder matches what replaces it. */}
                                <Skeleton
                                  className={cn("h-4", meta?.skeletonWidth ?? "w-24")}
                                />
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  : rows.map((row) => {
                      const selected = row.getIsSelected();
                      return (
                        <tr
                          key={row.id}
                          data-selected={selected ? "" : undefined}
                          onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                          className={cn(
                            "border-line h-row border-b last:border-b-0",
                            "transition-colors duration-instant ease-out",
                            selected
                              ? "bg-accent-subtle"
                              : "hover:bg-bg-subtle",
                            onRowClick && "cursor-pointer",
                            rowClassName?.(row.original)
                          )}
                        >
                          {row.getVisibleCells().map((cell, cellIndex) => {
                            const meta = cell.column.columnDef.meta;
                            return (
                              <td
                                key={cell.id}
                                className={cn(
                                  "text-body text-text-secondary px-4",
                                  meta?.align === "right" && "text-right",
                                  // The 2px accent bar (§6.1) rides the first
                                  // cell as an inset shadow — see the utility's
                                  // note in globals.css for why not a border.
                                  cellIndex === 0 && selected && "selected-bar"
                                )}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* ---- Mobile cards (§6.1: stacked under md) ---- */}
          {renderCard ? (
            <ul className="grid gap-2 md:hidden">
              {loading
                ? Array.from({ length: skeletonRows }, (_, i) => (
                    <li
                      key={`card-skeleton-${i}`}
                      className="border-line bg-bg-surface grid gap-2 rounded-lg border p-4"
                    >
                      <span className="flex items-center justify-between gap-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-20" />
                      </span>
                      <Skeleton className="h-3 w-40" />
                    </li>
                  ))
                : rows.map((row) => (
                    <li
                      key={row.id}
                      data-selected={row.getIsSelected() ? "" : undefined}
                      className={cn(
                        "border-line rounded-lg border",
                        "transition-colors duration-instant ease-out",
                        row.getIsSelected()
                          ? "bg-accent-subtle border-accent-border"
                          : "bg-bg-surface"
                      )}
                    >
                      {renderCard(row)}
                    </li>
                  ))}
            </ul>
          ) : null}

          {pagination ? (
            <Pagination
              table={table}
              pagination={pagination}
              rowCount={serverPaged ? pagination.totalRows : table.getFilteredRowModel().rows.length}
            />
          ) : null}
        </>
      )}

      {enableSelection ? (
        <BulkActionBar
          count={selectedRows.length}
          onClear={() => table.resetRowSelection()}
        >
          {renderBulkActions?.({
            rows: selectedRows,
            count: selectedRows.length,
            clear: () => table.resetRowSelection(),
          })}
        </BulkActionBar>
      ) : null}
    </div>
  );
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  const className = "size-4 shrink-0";
  if (direction === "asc") return <ArrowUp aria-hidden="true" className={className} />;
  if (direction === "desc") return <ArrowDown aria-hidden="true" className={className} />;
  // Neutral state still shows an affordance, so a sortable column is
  // discoverable without hovering every header to find out.
  return <ChevronsUpDown aria-hidden="true" className={cn(className, "text-text-tertiary")} />;
}

function Pagination<TData>({
  table,
  pagination,
  rowCount,
}: {
  table: ReturnType<typeof useReactTable<TData>>;
  pagination: DataTablePagination;
  rowCount: number;
}) {
  const pageSize =
    pagination.mode === "server" ? pagination.pageSize : (pagination.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageIndex =
    pagination.mode === "server" ? pagination.pageIndex : table.getState().pagination.pageIndex;
  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));

  // One page of rows needs no controls. Showing disabled arrows over a
  // 12-row table is chrome pretending to be a feature.
  if (rowCount <= pageSize) return null;

  const first = pageIndex * pageSize + 1;
  const last = Math.min(rowCount, (pageIndex + 1) * pageSize);

  const goTo = (next: number) => {
    if (pagination.mode === "server") pagination.onPageChange(next);
    else table.setPageIndex(next);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-meta text-text-tertiary tabular" aria-live="polite">
        {first}–{last} of {rowCount}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={pageIndex === 0}
          onClick={() => goTo(pageIndex - 1)}
        >
          Previous
        </Button>
        <span className="text-meta text-text-secondary tabular">
          Page {pageIndex + 1} of {pageCount}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={pageIndex + 1 >= pageCount}
          onClick={() => goTo(pageIndex + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

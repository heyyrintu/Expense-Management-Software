// DataTable public types (D1.2).
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";

/**
 * Per-column metadata this project's tables need on top of TanStack's.
 *
 * Declared through MODULE AUGMENTATION rather than by intersecting
 * `ColumnDef & { meta }`. ColumnDef is a union of accessor / display / group
 * shapes, and intersecting a union with an object distributes across every
 * member — so `selectionColumn`'s display column stopped being assignable to
 * a type that was supposed to describe it. Augmenting ColumnMeta is
 * TanStack's own mechanism for this and types `meta` on every column
 * definition without a cast at either end.
 */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * Right-aligns the header and every cell. Money columns always set this —
     * §5.3 puts amounts right-aligned and tabular so decimal points stack.
     */
    align?: "left" | "right";
    /**
     * Width of this column's loading skeleton, as a Tailwind width utility
     * ("w-24"), so placeholder rows match the real ones and nothing shifts
     * when the data lands.
     */
    skeletonWidth?: string;
    /** Label for the column-visibility menu, when the header isn't plain text. */
    label?: string;
    /** Keeps the column out of the visibility menu (selection, row actions). */
    alwaysVisible?: boolean;
    /** Present only to satisfy the augmented signature; never read. */
    __data?: [TData, TValue];
  }
}

/** The augmented meta shape, exported for documentation and for `satisfies`. */
export type DataTableColumnMeta = {
  align?: "left" | "right";
  skeletonWidth?: string;
  label?: string;
  alwaysVisible?: boolean;
};

/**
 * A column definition for this project's tables. `never` as the value generic
 * is TanStack's convention for "the cell renderer decides", which every
 * column here does — none of them lean on the default cell.
 */
export type DataTableColumn<TData> = ColumnDef<TData, never>;

/** Server-driven pagination. Omit for client-side paging (§6.1: past 50 rows). */
export type ServerPagination = {
  mode: "server";
  /** Zero-based. */
  pageIndex: number;
  pageSize: number;
  /** Total rows across all pages, for "showing x–y of z". */
  totalRows: number;
  onPageChange: (pageIndex: number) => void;
};

export type ClientPagination = {
  mode: "client";
  pageSize?: number;
};

export type DataTablePagination = ServerPagination | ClientPagination;

export type BulkActionContext<TData> = {
  rows: Row<TData>[];
  count: number;
  clear: () => void;
};

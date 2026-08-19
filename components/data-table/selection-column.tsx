"use client";

// The checkbox column (D1.2).
//
// A helper rather than something DataTable injects, because a screen needs to
// decide WHERE selection sits — usually first, but a table with a leading
// status bar might want it second — and because its label has to say what is
// being selected. "Select all" is useless in a screen reader's list of
// twenty checkboxes; "Select expense from IndiGo" is not.
import { Checkbox } from "@/components/ui/checkbox";
import type { DataTableColumn } from "./types";

export function selectionColumn<TData>({
  rowLabel,
  allLabel = "Select all rows on this page",
}: {
  /** Per-row accessible name, e.g. (row) => `Select ${row.merchant}`. */
  rowLabel: (row: TData) => string;
  allLabel?: string;
}): DataTableColumn<TData> {
  return {
    id: "select",
    enableSorting: false,
    enableHiding: false,
    meta: { alwaysVisible: true, skeletonWidth: "w-4" },
    header: ({ table }) => (
      <Checkbox
        aria-label={allLabel}
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
      />
    ),
    cell: ({ row }) => (
      <span
        // The checkbox must not trigger the row's own click handler — ticking
        // a box to bulk-edit should never navigate you away from the list.
        onClick={(e) => e.stopPropagation()}
        className="flex"
      >
        <Checkbox
          aria-label={rowLabel(row.original)}
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v === true)}
        />
      </span>
    ),
  };
}

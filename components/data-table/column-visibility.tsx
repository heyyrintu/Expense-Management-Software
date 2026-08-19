"use client";

// Column visibility menu (D1.2, §6.1).
//
// A popover of checkboxes, one per hideable column. Columns that carry no
// data of their own — the selection checkbox, the row-actions cell — opt out
// via `meta.alwaysVisible`, because offering to hide the thing you select
// rows with is a trap.
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fadeScale } from "@/lib/motion";

export function ColumnVisibilityMenu<TData>({ table }: { table: Table<TData> }) {
  const [open, setOpen] = React.useState(false);

  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && !column.columnDef.meta?.alwaysVisible);

  if (columns.length === 0) return null;

  const hiddenCount = columns.filter((c) => !c.getIsVisible()).length;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="secondary" size="sm">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Columns
          {/* The count is the only hint that something is hidden — without it
              a colleague's collapsed column looks like missing data. */}
          {hiddenCount > 0 ? (
            <span className="text-meta text-text-tertiary tabular">{hiddenCount} hidden</span>
          ) : null}
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} asChild>
          <motion.div
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            className="border-line bg-bg-surface shadow-overlay origin-popover z-50 w-56 rounded-md border p-1"
          >
            <p className="text-meta text-text-tertiary px-3 py-2">Show columns</p>
            <ul className="grid">
              {columns.map((column) => {
                const label =
                  column.columnDef.meta?.label ??
                  (typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id);
                return (
                  <li key={column.id}>
                    <label className="text-label text-text-secondary hover:bg-bg-subtle flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 transition-colors duration-instant ease-out">
                      <Checkbox
                        checked={column.getIsVisible()}
                        onCheckedChange={(v) => column.toggleVisibility(v === true)}
                      />
                      {label}
                    </label>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

"use client";

// Active-filter chips (D1.3).
//
// The point of these is that a filtered list should never be a mystery. A
// count ("3 filters") tells you that something is hidden without telling you
// what — these say which, and each removes only itself.
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { statusEntry } from "@/lib/design/status";
import { activeFilterCount, type ExpenseFilters } from "@/lib/schemas/expense-filters";
import { cn } from "@/lib/utils";
import { rangeLabel } from "./date-range-select";
import type { FacetConfig } from "./types";

type Chip = {
  id: string;
  /** What the chip filters on — "Category", "Search". */
  prefix: string;
  label: string;
  remove: () => void;
};

export function ActiveChips({
  filters,
  facets,
  onChange,
  className,
}: {
  filters: ExpenseFilters;
  facets: FacetConfig[];
  onChange: (next: ExpenseFilters) => void;
  className?: string;
}) {
  const chips: Chip[] = [];

  if (filters.q) {
    chips.push({
      id: "q",
      prefix: "Search",
      label: filters.q,
      remove: () => onChange({ ...filters, q: undefined }),
    });
  }

  // One chip for the range, not one per end — removing "from" and leaving
  // "to" is a state nobody asks for.
  if (filters.from || filters.to) {
    chips.push({
      id: "date",
      prefix: "Date",
      label: rangeLabel(filters.from, filters.to),
      remove: () => onChange({ ...filters, from: undefined, to: undefined }),
    });
  }

  for (const facet of facets) {
    for (const value of filters[facet.key]) {
      const option = facet.options.find((o) => o.value === value);
      chips.push({
        id: `${facet.key}:${value}`,
        prefix: facet.label,
        // Status values are domain enums, so they get the same human label
        // StatusBadge uses rather than a raw "sent_back".
        label:
          option?.label ?? (facet.key === "status" ? statusEntry(value).label : value),
        remove: () =>
          onChange({ ...filters, [facet.key]: filters[facet.key].filter((v) => v !== value) }),
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="border-line bg-bg-surface text-label text-text-secondary flex items-center gap-1 rounded-sm border py-1 pr-1 pl-2"
        >
          <span className="text-text-tertiary text-meta">{chip.prefix}</span>
          <span className="max-w-40 truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.remove}
            // The visible box is 20px so the chip stays chip-sized; the
            // pseudo-element under it clears the 44px touch target.
            aria-label={`Remove ${chip.prefix} filter ${chip.label}`}
            className={cn(
              "text-text-tertiary hover:text-text-primary relative grid size-5 place-items-center rounded-sm",
              "transition-colors duration-instant ease-out",
              "after:absolute after:inset-0 after:-m-3 after:content-['']",
              "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
            )}
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}

      {activeFilterCount(filters) > 1 ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange({
              status: [],
              categoryId: [],
              projectId: [],
              departmentId: [],
              userId: [],
            })
          }
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

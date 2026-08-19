"use client";

// FilterBar (D1.3) — DESIGN-PRD §7.2.
//
// Controlled, not stateful: it takes a value and reports changes. The screen
// decides where that value lives — useUrlFilters() for a real screen, local
// state for the gallery. Keeping the URL out of here is what makes the
// component testable and reusable in a context that has no router.
//
// Under md the whole thing collapses to one "Filters" button with a count
// badge, opening a Vaul sheet. Same controls, same handlers — the sheet is a
// different container, not a different filter bar.
import * as React from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { activeFilterCount, type ExpenseFilters } from "@/lib/schemas/expense-filters";
import { cn } from "@/lib/utils";
import { ActiveChips } from "./active-chips";
import { DateRangeSelect } from "./date-range-select";
import { FacetSelect } from "./facet-select";
import type { FilterBarConfig } from "./types";
import { useDebouncedText } from "./use-url-filters";

export function FilterBar({
  config,
  value,
  onChange,
  className,
}: {
  config: FilterBarConfig;
  value: ExpenseFilters;
  onChange: (next: ExpenseFilters) => void;
  className?: string;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const count = activeFilterCount(value);

  const setSearch = React.useCallback(
    (q: string) => onChange({ ...value, q: q.trim() ? q.trim() : undefined }),
    [onChange, value]
  );
  const [draft, setDraft] = useDebouncedText(value.q ?? "", setSearch);

  const controls = (
    <>
      {config.dateRange ? (
        <DateRangeSelect
          from={value.from}
          to={value.to}
          onChange={(next) => onChange({ ...value, ...next })}
        />
      ) : null}
      {config.facets.map((facet) => (
        <FacetSelect
          key={facet.key}
          facet={facet}
          selected={value[facet.key]}
          onChange={(next) => onChange({ ...value, [facet.key]: next })}
        />
      ))}
    </>
  );

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {config.search ? (
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={config.search.placeholder}
            aria-label={config.search.placeholder}
            className="w-full sm:w-64"
          />
        ) : null}

        {/* Desktop: the controls inline. */}
        <span className="hidden flex-wrap items-center gap-2 md:flex">{controls}</span>

        {/* Mobile: one button carrying the count (§7.2). */}
        <Button
          size="sm"
          variant="secondary"
          className="md:hidden"
          onClick={() => setSheetOpen(true)}
          aria-label={count > 0 ? `Filters, ${count} active` : "Filters"}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filters
          {count > 0 ? (
            <span className="bg-accent-subtle text-accent-text rounded-sm px-1 text-meta tabular">
              {count}
            </span>
          ) : null}
        </Button>
      </div>

      <ActiveChips filters={value} facets={config.facets} onChange={onChange} />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          {/* Stacked full-width in the sheet: a row of popover triggers on a
              360px screen is four targets fighting for the same 40px. */}
          <div className="grid gap-3 [&_button]:w-full [&_button]:justify-between">
            {controls}
          </div>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

// Dashboard filter bar (D3.3).
//
// The same `components/filters` every list uses, over the same URL contract.
// That is the point: a range picked on the dashboard and a range picked on
// /expenses are the same three query parameters, so following a KPI carries
// the reader's filters with them instead of resetting to "everything".
//
// Config, not hand-assembled controls (CLAUDE.md). The facets a role may use
// are decided on the server and passed in — an employee has no business
// filtering by department, and the way to express that is to not send the
// facet, not to hide a control.
import { FilterBar, useUrlFilters, type FacetConfig } from "@/components/filters";

export function DashboardFilters({ facets }: { facets: FacetConfig[] }) {
  const { filters, setFilters, pending } = useUrlFilters();

  return (
    <FilterBar
      config={{
        // No search box: a merchant substring narrows a LIST usefully and a
        // chart pointlessly — "spend by category, for merchants matching
        // 'uber'" is a question nobody asks of a dashboard.
        dateRange: true,
        facets,
      }}
      value={filters}
      onChange={setFilters}
      className={pending ? "opacity-60 transition-opacity duration-instant ease-out" : undefined}
    />
  );
}

"use client";

// FilterBar (D1.3) — DESIGN-PRD §7.2.
//
// Driven by local state here rather than the URL, because the gallery has no
// list to filter and hijacking the page's query string would fight the
// table-of-contents anchors. The component is controlled for exactly this
// reason: the screen decides where the value lives.
//
// The query string the same state WOULD produce is printed underneath, since
// the URL contract is the part worth reviewing — it is what makes a filtered
// view survivable and shareable.
import * as React from "react";

import { FilterBar, type FilterBarConfig } from "@/components/filters";
import { statusEntry } from "@/lib/design/status";
import {
  EMPTY_EXPENSE_FILTERS,
  EXPENSE_STATUSES,
  activeFilterCount,
  expenseFiltersToParams,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";
import { Block, Group, Panel } from "./shared";

const CATEGORIES = [
  { id: "0192f0a0-0000-7000-8000-0000000000c1", name: "Travel" },
  { id: "0192f0a0-0000-7000-8000-0000000000c2", name: "Meals" },
  { id: "0192f0a0-0000-7000-8000-0000000000c3", name: "Software" },
  { id: "0192f0a0-0000-7000-8000-0000000000c4", name: "Lodging" },
];

const PROJECTS = [
  { id: "0192f0a0-0000-7000-8000-0000000000p1", name: "Mumbai review" },
  { id: "0192f0a0-0000-7000-8000-0000000000p2", name: "Q3 offsite" },
];

export function FiltersSection() {
  const [filters, setFilters] = React.useState<ExpenseFilters>(EMPTY_EXPENSE_FILTERS);

  const config = React.useMemo<FilterBarConfig>(
    () => ({
      search: { placeholder: "Search merchant" },
      dateRange: true,
      facets: [
        {
          key: "status",
          label: "Status",
          options: EXPENSE_STATUSES.map((s) => ({ value: s, label: statusEntry(s).label })),
        },
        {
          key: "categoryId",
          label: "Category",
          options: CATEGORIES.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          key: "projectId",
          label: "Project",
          options: PROJECTS.map((p) => ({ value: p.id, label: p.name })),
        },
      ],
    }),
    []
  );

  const query = expenseFiltersToParams(filters).toString();

  return (
    <Group
      id="filters"
      eyebrow="§7.2"
      title="FilterBar"
      description="Search, a date range with presets, and multi-select facets described as config rather than assembled by hand. Every list gets the same chips, the same mobile sheet and the same URL contract without re-deciding them."
    >
      <Block
        title="The bar"
        description="Pick some filters and watch the query string below. That string is the whole state — there is no second copy, which is why a filtered view survives refresh and can be pasted into chat."
      >
        <Panel>
          <FilterBar config={config} value={filters} onChange={setFilters} />
        </Panel>

        <Panel title="Resulting URL">
          <code className="text-label text-text-secondary break-all">
            /expenses{query ? `?${query}` : ""}
          </code>
          <p className="text-meta text-text-tertiary">
            {activeFilterCount(filters)} active. Empty values are omitted
            entirely, so an unfiltered view has a clean URL and two identical
            filter states always produce the same string. Multi-select writes
            repeated keys — <code>?status=draft&amp;status=approved</code> —
            rather than a comma-joined list nothing else can parse.
          </p>
        </Panel>
      </Block>

      <Block
        title="What the pieces do"
        description="Each control earns its place, and a couple of them make a decision worth knowing about."
      >
        <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
          <table className="w-full text-body">
            <thead className="bg-bg-subtle text-text-secondary text-label">
              <tr>
                <th className="p-3 text-left font-medium">Control</th>
                <th className="p-3 text-left font-medium">Behaviour</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {[
                [
                  "Search",
                  "Types locally, commits to the URL after 300ms. Without the debounce every keystroke would be a server round-trip and the input would fight results arriving mid-word.",
                ],
                [
                  "Date range",
                  "The URL stores the resolved dates, never the preset name — “This month” shared on 31 August still means August when opened in September. The preset button lights up by reading the dates back.",
                ],
                [
                  "Facets",
                  "Checkbox popovers. The trigger shows a count rather than turning accent: accent means “act here”, and an applied filter is not asking to be acted on.",
                ],
                [
                  "Chips",
                  "One per applied value, each removing only itself. A count alone tells you something is hidden without telling you what.",
                ],
                [
                  "Date chip",
                  "One chip for the whole range. Removing “from” and leaving “to” is a state nobody asks for.",
                ],
                [
                  "Clear all",
                  "Appears past a single filter — offering to clear one filter next to the chip that already clears it is noise.",
                ],
                [
                  "Under md",
                  "The controls collapse into one Filters button with an active count, opening a Vaul sheet. Same controls and handlers, different container.",
                ],
              ].map(([control, behaviour]) => (
                <tr key={control}>
                  <td className="text-text-primary p-3 align-top">{control}</td>
                  <td className="text-text-secondary p-3 text-meta">{behaviour}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </Group>
  );
}

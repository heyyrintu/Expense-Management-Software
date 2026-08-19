// Filter bar configuration (D1.3).
//
// A screen describes its facets as data rather than assembling controls, so
// every list gets the same behaviour — the same chip wording, the same mobile
// sheet, the same URL contract — without each one re-deciding it.
import type { ExpenseFilters } from "@/lib/schemas/expense-filters";

export type FacetOption = {
  value: string;
  label: string;
};

/** Which EXPENSE filter key a facet writes to. */
export type FacetKey = "status" | "categoryId" | "projectId" | "departmentId" | "userId";

/**
 * A facet's key is generic (D4.3) so screens with their own URL contract can
 * reuse the real control instead of hand-assembling one.
 *
 * `FilterBar` still pins it to `FacetKey`, because that component indexes an
 * `ExpenseFilters` object by it. `FacetSelect` does not — it takes a label,
 * some options and a value — so the complaints inbox composes it directly
 * with `status` / `type` / `age` keys of its own. Same menu, same chips, same
 * behaviour; a different bag of state behind it.
 */
export type FacetConfig<K extends string = FacetKey> = {
  key: K;
  /** Menu and chip label, singular — "Category", not "Categories". */
  label: string;
  options: FacetOption[];
};

export type FilterValue = ExpenseFilters;

export type FilterBarConfig = {
  /** Omit to hide the search input. */
  search?: { placeholder: string };
  /** Omit to hide the date-range control. */
  dateRange?: boolean;
  facets: FacetConfig<FacetKey>[];
};

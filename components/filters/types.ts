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

/** Which filter key a facet writes to. */
export type FacetKey = "status" | "categoryId" | "projectId" | "departmentId" | "userId";

export type FacetConfig = {
  key: FacetKey;
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
  facets: FacetConfig[];
};

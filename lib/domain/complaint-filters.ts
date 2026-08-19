// Complaints inbox filters (D4.3) — the URL contract.
//
// Separate from lib/schemas/expense-filters.ts, and multi-valued, for the
// same reason the expense list has its own: these facets narrow COMPLAINTS
// (status, type, SLA age), and folding them into the expense schema would
// change every expense query for a UI reason.
//
// THE URL IS THE STATE, as everywhere else — a filtered inbox survives
// refresh and can be pasted to a colleague. Anything unparseable is dropped
// per field rather than throwing: one bad value in a shared link shouldn't
// discard the status filter the reader came for.
import {
  COMPLAINT_STATUSES,
  COMPLAINT_TYPES,
  type ComplaintStatus,
  type ComplaintType,
} from "./complaint";

/** SLA buckets the Age facet offers. Both are "at least this old". */
export const COMPLAINT_AGE_FILTERS = ["warning", "breached"] as const;
export type ComplaintAgeFilter = (typeof COMPLAINT_AGE_FILTERS)[number];

export type ComplaintUrlFilters = {
  status: ComplaintStatus[];
  type: ComplaintType[];
  age: ComplaintAgeFilter[];
  /** Finance only: restrict to complaints assigned to the reader. */
  mine: boolean;
};

export const EMPTY_COMPLAINT_FILTERS: ComplaintUrlFilters = {
  status: [],
  type: [],
  age: [],
  mine: false,
};

type RawParams = Record<string, string | string[] | undefined>;

function list(raw: RawParams, key: string): string[] {
  const v = raw[key];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string" && v !== "") return [v];
  return [];
}

export function parseComplaintFilters(raw: RawParams): ComplaintUrlFilters {
  return {
    status: list(raw, "status").filter((v): v is ComplaintStatus =>
      (COMPLAINT_STATUSES as readonly string[]).includes(v)
    ),
    type: list(raw, "type").filter((v): v is ComplaintType =>
      (COMPLAINT_TYPES as readonly string[]).includes(v)
    ),
    age: list(raw, "age").filter((v): v is ComplaintAgeFilter =>
      (COMPLAINT_AGE_FILTERS as readonly string[]).includes(v)
    ),
    mine: raw.mine === "1",
  };
}

/** The inverse. Empty values are omitted, so an unfiltered inbox has a clean
 *  URL and two identical filter states always produce the same string. */
export function complaintFiltersToParams(
  filters: ComplaintUrlFilters
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["status", "type", "age"] as const) {
    for (const value of filters[key]) params.append(key, value);
  }
  if (filters.mine) params.set("mine", "1");
  return params;
}

export function complaintFilterCount(filters: ComplaintUrlFilters): number {
  return (
    filters.status.length +
    filters.type.length +
    filters.age.length +
    (filters.mine ? 1 : 0)
  );
}

/**
 * The SLA floor a set of age filters implies, in business days.
 *
 * Selecting BOTH "3+ days" and "Past SLA" means "either", and either is
 * satisfied by the looser one — so the floor is the MINIMUM, not the maximum.
 * Taking the max would make ticking a second box return fewer rows, which is
 * the opposite of what a multi-select promises.
 */
export function ageFloorBusinessDays(
  age: ComplaintAgeFilter[]
): number | null {
  if (age.length === 0) return null;
  return Math.min(...age.map((a) => (a === "breached" ? 5 : 3)));
}

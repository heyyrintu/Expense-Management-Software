// Expense-list filters (D1.3) — the URL contract.
//
// Separate from lib/schemas/dashboard.ts on purpose. That schema is
// single-valued and feeds the dashboard's aggregates; this one is
// multi-valued (§7.2 asks for multi-select facets) and feeds the list. Making
// the dashboard's schema multi-valued to serve the list would change every
// dashboard query for a UI reason, so the two stay separate and the list gets
// its own contract.
//
// THE URL IS THE STATE. Everything here round-trips through a query string so
// a filtered view can be refreshed, bookmarked and pasted into chat. Anything
// unparseable is dropped rather than throwing: a hand-edited or truncated URL
// should degrade to a wider list, never to an error page.
import { z } from "zod";

import { toDateString } from "@/lib/date-range";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuidList = z.array(z.string().uuid());

export const EXPENSE_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "reimbursed",
] as const;

export const expenseFilterSchema = z.object({
  /** Free-text merchant search. */
  q: z.string().trim().min(1).max(120).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  status: z.array(z.enum(EXPENSE_STATUSES)).default([]),
  categoryId: uuidList.default([]),
  projectId: uuidList.default([]),
  departmentId: uuidList.default([]),
  userId: uuidList.default([]),
});

export type ExpenseFilters = z.infer<typeof expenseFilterSchema>;

export const EMPTY_EXPENSE_FILTERS: ExpenseFilters = {
  status: [],
  categoryId: [],
  projectId: [],
  departmentId: [],
  userId: [],
};

type RawParams = Record<string, string | string[] | undefined>;

/** Repeated keys (`?status=draft&status=submitted`) arrive as string[]. */
function list(raw: RawParams, key: string): string[] {
  const v = raw[key];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string" && v !== "") return [v];
  return [];
}

function single(raw: RawParams, key: string): string | undefined {
  const v = raw[key];
  if (Array.isArray(v)) return v[0] || undefined;
  return typeof v === "string" && v !== "" ? v : undefined;
}

/**
 * Parse search params into filters, dropping anything invalid FIELD BY FIELD.
 *
 * Per-field rather than all-or-nothing: one malformed uuid in a shared link
 * shouldn't silently discard the date range the reader came for. A bad value
 * disappears; everything valid around it survives.
 */
export function parseExpenseFilters(raw: RawParams): ExpenseFilters {
  const out: ExpenseFilters = { ...EMPTY_EXPENSE_FILTERS };

  const q = expenseFilterSchema.shape.q.safeParse(single(raw, "q"));
  if (q.success && q.data) out.q = q.data;

  const from = dateStr.safeParse(single(raw, "from"));
  if (from.success) out.from = from.data;
  const to = dateStr.safeParse(single(raw, "to"));
  if (to.success) out.to = to.data;

  // A reversed range is a typo, not an instruction to return nothing.
  if (out.from && out.to && out.from > out.to) {
    [out.from, out.to] = [out.to, out.from];
  }

  out.status = list(raw, "status").filter(
    (s): s is (typeof EXPENSE_STATUSES)[number] =>
      (EXPENSE_STATUSES as readonly string[]).includes(s)
  );
  for (const key of ["categoryId", "projectId", "departmentId", "userId"] as const) {
    out[key] = list(raw, key).filter((v) => z.string().uuid().safeParse(v).success);
  }

  return out;
}

/**
 * The inverse. Empty values are omitted entirely rather than written as
 * `?q=&status=`, so an unfiltered view has a clean URL and two identical
 * filter states always produce the same string.
 */
export function expenseFiltersToParams(filters: ExpenseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  for (const key of ["status", "categoryId", "projectId", "departmentId", "userId"] as const) {
    for (const value of filters[key]) params.append(key, value);
  }
  return params;
}

/**
 * Group a URLSearchParams into the shape Next hands a server component.
 *
 * Repeated keys have to survive: `?status=draft&status=submitted` is two
 * values, and Object.fromEntries on the raw iterator keeps only the last —
 * which would silently drop every multi-select but the final one. Exported
 * so the client hook and the round-trip tests share one implementation
 * instead of two that agree until they don't.
 */
export function searchParamsToRecord(params: URLSearchParams): RawParams {
  const grouped = new Map<string, string[]>();
  for (const [key, value] of params.entries()) {
    const existing = grouped.get(key);
    if (existing) existing.push(value);
    else grouped.set(key, [value]);
  }
  const out: RawParams = {};
  for (const [key, values] of grouped) {
    out[key] = values.length === 1 ? values[0] : values;
  }
  return out;
}

/** How many filters are applied — the mobile "Filters" button's badge. */
export function activeFilterCount(filters: ExpenseFilters): number {
  let n = 0;
  if (filters.q) n += 1;
  // A range counts once however many of its two ends are set: "1 filter" is
  // what a reader means by a date range, not "2".
  if (filters.from || filters.to) n += 1;
  n += filters.status.length;
  n += filters.categoryId.length;
  n += filters.projectId.length;
  n += filters.departmentId.length;
  n += filters.userId.length;
  return n;
}

export function hasActiveFilters(filters: ExpenseFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/** Today in UTC, as the date inputs expect. Used for preset resolution. */
export function todayDateString(now: Date = new Date()): string {
  return toDateString(now);
}

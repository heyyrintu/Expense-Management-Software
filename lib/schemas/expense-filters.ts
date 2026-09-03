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
//
// NO ZOD HERE, deliberately. This module is imported by `useUrlFilters`, which
// runs in the browser on every list screen and on the dashboard, and it was
// the only thing putting the whole zod runtime (25 KB gzipped — more than
// every Radix primitive combined) into those pages' critical path. The
// contract is four regular expressions and an enum, checked field by field;
// a schema object added nothing but the dependency. The entity schemas in
// this folder still use zod, because a FORM needs zod's error messages and
// `zodResolver`; a query string only needs "keep or drop".
import { toDateString } from "@/lib/date-range";

export const EXPENSE_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "reimbursed",
] as const;

export type ExpenseStatusFilter = (typeof EXPENSE_STATUSES)[number];

export type ExpenseFilters = {
  /** Free-text merchant search. */
  q?: string;
  from?: string;
  to?: string;
  status: ExpenseStatusFilter[];
  categoryId: string[];
  projectId: string[];
  departmentId: string[];
  userId: string[];
};

export const EMPTY_EXPENSE_FILTERS: ExpenseFilters = {
  status: [],
  categoryId: [],
  projectId: [],
  departmentId: [],
  userId: [],
};

/** `YYYY-MM-DD` by shape. Reality (2026-13-45) is the ledger's problem, not the list's: the list treats a nonsense date as an empty range. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * RFC 9562 UUID, the same test zod 4's `z.uuid()` applies: version nibble
 * 1–8, variant 8–b, plus the nil and max UUIDs. Kept identical so a URL that
 * parsed before this module dropped zod still parses the same way.
 */
const UUID_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

const Q_MAX = 120;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

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

function isStatus(value: string): value is ExpenseStatusFilter {
  return (EXPENSE_STATUSES as readonly string[]).includes(value);
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

  const q = single(raw, "q")?.trim();
  if (q && q.length <= Q_MAX) out.q = q;

  const from = single(raw, "from");
  if (from && DATE_RE.test(from)) out.from = from;
  const to = single(raw, "to");
  if (to && DATE_RE.test(to)) out.to = to;

  // A reversed range is a typo, not an instruction to return nothing.
  if (out.from && out.to && out.from > out.to) {
    [out.from, out.to] = [out.to, out.from];
  }

  out.status = list(raw, "status").filter(isStatus);
  for (const key of ["categoryId", "projectId", "departmentId", "userId"] as const) {
    out[key] = list(raw, key).filter(isUuid);
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

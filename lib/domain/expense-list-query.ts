// The expense list's query, derived ONCE (G1).
//
// ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────
// /expenses and /api/exports/expenses must return the same rows. They did
// not. The screen read `parseExpenseFilters` (multi-valued, D1.3) and pinned
// scope with `viewScopeWhere`; the export route read `parseFilters` from
// lib/schemas/dashboard (single-valued) and pinned scope with the role
// CEILING alone. The consequences were silent, which is what made them bad:
//
//   * `?q=uber` was dropped — the schema has no `q`, so the CSV carried every
//     merchant while the table showed one.
//   * `?status=draft&status=submitted` kept only the FIRST value. Two ticked
//     facets, one exported.
//   * `?userId=` was dropped entirely.
//   * `?scope=mine` was ignored, so an approver looking at their own rows
//     exported their whole team's.
//   * Delegation was ignored: acting for someone else, the screen showed the
//     principal's expenses and the export returned the delegate's.
//
// None of that raises an error. You get a file, it looks plausible, and it is
// answering a different question than the screen was. The ledger already
// solved this — app/api/exports/ledger/route.ts runs the SAME derivation as
// app/(app)/ledger/page.tsx rather than a matching one — and this is that
// pattern applied to expenses.
//
// So: both callers ask this module for the where-clause, and neither builds
// one. tests/isolation/expense-export.test.ts runs both paths against a real
// database and compares the row counts.
// ──────────────────────────────────────────────────────────────────────────
import type { ActingCtx } from "@/lib/auth/acting";
import type { SessionCtx } from "@/lib/auth/guard";
import type { ScopedDb } from "@/lib/db/scoped";
import {
  expenseFiltersToParams,
  parseExpenseFilters,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";
import { applyExpenseFilters } from "./expense-query";
import {
  narrowViewScope,
  parseViewScope,
  resolveExpenseScope,
  viewScopeWhere,
  type ExpenseViewScope,
} from "./expense-scope";

type RawParams = Record<string, string | string[] | undefined>;

export type ExpenseListQuery = {
  /** Parsed filters — the multi-valued D1.3 contract. */
  filters: ExpenseFilters;
  /** What the reader may actually see, after the ceiling clamps the request. */
  scope: ExpenseViewScope;
  /** Scope alone, before filters. The trend chart needs this separately. */
  scopeWhere: Record<string, unknown>;
  /** Scope AND filters — the one where-clause. */
  where: Record<string, unknown>;
};

/**
 * Resolve the expense list's query from a URL.
 *
 * `acting` is passed in rather than resolved here because `resolveActing`
 * reads cookies(), which a route handler and a server component may call but
 * a unit test cannot — keeping it a parameter makes this function pure with
 * respect to the request.
 *
 * Note the order: the scope predicate is built first and the filters are
 * ANDed onto it by `applyExpenseFilters`, never spread over it. A `userId`
 * facet spread over a pinned `userId` would overwrite the pin — see the note
 * in lib/domain/expense-query.ts.
 */
export async function resolveExpenseListQuery(
  db: ScopedDb,
  ctx: SessionCtx,
  acting: ActingCtx,
  raw: RawParams
): Promise<ExpenseListQuery> {
  const filters = parseExpenseFilters(raw);
  const ceiling = await resolveExpenseScope(db, ctx);
  const requested = parseViewScope(raw.scope);
  const scopeWhere = viewScopeWhere(ceiling, requested, acting.effectiveUserId);
  return {
    filters,
    scope: narrowViewScope(ceiling, requested),
    scopeWhere,
    where: applyExpenseFilters(scopeWhere, filters),
  };
}

/** Where the export route lives. One constant so the button and the tests
 *  cannot point at a path the route no longer serves. */
export const EXPENSE_EXPORT_PATH = "/api/exports/expenses";

/**
 * Row ceiling on one export.
 *
 * A cap is a lie the moment it is silently hit, so the button says the number
 * before the reader clicks (see ExportButton) and the tests assert against
 * this same constant rather than a repeated literal. Well above any filtered
 * view a person exports by hand; a finance team wanting the whole year takes
 * the ledger export, which is built for volume.
 */
export const EXPENSE_EXPORT_MAX_ROWS = 10_000;

/**
 * The CSV export's URL for a filter state.
 *
 * Deliberately the same serialisation as `expenseListHref` in
 * lib/domain/dashboard-kpi.ts — same `expenseFiltersToParams`, same
 * scope-rides-alongside rule, same omission of the default "mine". Only the
 * path differs, which is the property that makes "export what I am looking
 * at" true rather than aspirational. tests/unit/expense-export-href.test.ts
 * asserts the two produce identical query strings for the same input, so they
 * cannot drift apart.
 */
export function expenseExportHref(
  filters: ExpenseFilters,
  opts: { scope?: ExpenseViewScope } = {}
): string {
  const params = expenseFiltersToParams(filters);
  if (opts.scope && opts.scope !== "mine") params.set("scope", opts.scope);
  const query = params.toString();
  return query ? `${EXPENSE_EXPORT_PATH}?${query}` : EXPENSE_EXPORT_PATH;
}

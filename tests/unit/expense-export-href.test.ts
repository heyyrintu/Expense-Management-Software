// The export link and the list link must serialise identically (G1).
//
// `expenseListHref` (lib/domain/dashboard-kpi.ts) and `expenseExportHref`
// (lib/domain/expense-list-query.ts) describe the same filter state pointed at
// two different paths. If they ever disagree about how a filter becomes a
// query string, the Export button silently downloads a different set than the
// screen — which is the whole failure G1 exists to fix, reintroduced one
// level up.
//
// So this asserts the property directly: same filters in, same query string
// out, for every field of the schema and for the scope that rides beside it.
import { describe, expect, it } from "vitest";

import { expenseListHref } from "@/lib/domain/dashboard-kpi";
import {
  EXPENSE_EXPORT_PATH,
  expenseExportHref,
} from "@/lib/domain/expense-list-query";
import {
  EMPTY_EXPENSE_FILTERS,
  parseExpenseFilters,
  searchParamsToRecord,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";
import type { ExpenseViewScope } from "@/lib/domain/expense-scope";

const UUID_A = "018f0000-0000-7000-8000-000000000001";
const UUID_B = "018f0000-0000-7000-8000-000000000002";

/** The query string half of a href, whichever path it carries. */
function query(href: string): string {
  const q = href.indexOf("?");
  return q === -1 ? "" : href.slice(q + 1);
}

const CASES: Array<{ name: string; filters: ExpenseFilters; scope?: ExpenseViewScope }> = [
  { name: "no filters", filters: EMPTY_EXPENSE_FILTERS },
  {
    name: "merchant search",
    filters: { ...EMPTY_EXPENSE_FILTERS, q: "uber eats" },
  },
  {
    name: "date range",
    filters: { ...EMPTY_EXPENSE_FILTERS, from: "2026-07-01", to: "2026-07-31" },
  },
  {
    name: "multi-select status",
    filters: { ...EMPTY_EXPENSE_FILTERS, status: ["submitted", "approved"] },
  },
  {
    name: "multi-select categories and projects",
    filters: {
      ...EMPTY_EXPENSE_FILTERS,
      categoryId: [UUID_A, UUID_B],
      projectId: [UUID_B],
    },
  },
  {
    name: "user and department facets",
    filters: { ...EMPTY_EXPENSE_FILTERS, userId: [UUID_A], departmentId: [UUID_B] },
  },
  {
    name: "everything at once, org scope",
    filters: {
      q: "taxi",
      from: "2026-01-01",
      to: "2026-12-31",
      status: ["draft", "reimbursed"],
      categoryId: [UUID_A],
      projectId: [UUID_B],
      departmentId: [UUID_A],
      userId: [UUID_B],
    },
    scope: "org",
  },
  {
    name: "team scope",
    filters: { ...EMPTY_EXPENSE_FILTERS, status: ["submitted"] },
    scope: "team",
  },
];

describe("expenseExportHref ↔ expenseListHref", () => {
  for (const c of CASES) {
    it(`serialises identically — ${c.name}`, () => {
      const list = expenseListHref(c.filters, { scope: c.scope });
      const exp = expenseExportHref(c.filters, { scope: c.scope });
      expect(query(exp)).toBe(query(list));
    });
  }

  it("points at the export route, not the list", () => {
    expect(expenseExportHref(EMPTY_EXPENSE_FILTERS)).toBe(EXPENSE_EXPORT_PATH);
    expect(
      expenseExportHref({ ...EMPTY_EXPENSE_FILTERS, q: "uber" })
    ).toMatch(new RegExp(`^${EXPENSE_EXPORT_PATH}\\?`));
  });

  it("omits the default scope so an employee's link stays clean", () => {
    expect(expenseExportHref(EMPTY_EXPENSE_FILTERS, { scope: "mine" })).toBe(
      EXPENSE_EXPORT_PATH
    );
  });

  it("round-trips: the route parses back exactly what the button serialised", () => {
    // The property that actually matters — the button writes a URL, the route
    // parses it, and what comes out is the filter state the screen held.
    for (const c of CASES) {
      const href = expenseExportHref(c.filters, { scope: c.scope });
      const parsed = parseExpenseFilters(
        searchParamsToRecord(new URLSearchParams(query(href)))
      );
      expect(parsed).toEqual(c.filters);
    }
  });
});

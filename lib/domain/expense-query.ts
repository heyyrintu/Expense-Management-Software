// One query builder feeds the dashboard, its tables, and the CSV export —
// so every number reconciles with every list by construction.
// Scope is derived from the ROLE server-side; orgId is injected by scopedDb.
import type { DashboardFilters } from "@/lib/schemas/dashboard";
import type { ExpenseFilters } from "@/lib/schemas/expense-filters";

export type ExpenseScope =
  | { kind: "employee"; userId: string }
  | { kind: "team"; teamUserIds: string[] } // approver: direct reports
  | { kind: "org" }; // finance_admin+

type Where = Record<string, unknown>;

export function buildExpenseWhere(
  scope: ExpenseScope,
  filters: DashboardFilters
): Where {
  const where: Where = {};

  if (scope.kind === "employee") {
    where.userId = scope.userId; // always pinned — never widened by filters
  } else if (scope.kind === "team") {
    where.userId = { in: scope.teamUserIds };
  }

  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T00:00:00.000Z`) } : {}),
    };
  }
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  // department is a property of the expense owner
  if (filters.departmentId) {
    where.user = { departmentId: filters.departmentId };
  }
  return where;
}

/**
 * Multi-select filter predicates for the expense LIST (D1.3).
 *
 * ── FILTERS MAY ONLY NARROW ────────────────────────────────────────────────
 * The result of this function is meant to go inside an `AND`, never to be
 * spread over a scope predicate:
 *
 *     applyExpenseFilters({ userId: acting.effectiveUserId }, filters)
 *
 * That is not style. A user facet emits `userId`, and spreading it over a
 * pinned `userId` would OVERWRITE the pin — object spread lets the later key
 * win — so an employee could filter their way into a colleague's expenses.
 * Inside an `AND` the two predicates intersect instead, and the pin always
 * survives. `applyExpenseFilters` exists so a caller cannot get this wrong;
 * tests/unit/expense-filters.test.ts asserts the pin holds even when the
 * filter names somebody else.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function buildExpenseListWhere(filters: ExpenseFilters): Where {
  const where: Where = {};

  if (filters.q) {
    // Merchant only. Searching purpose and amount too sounds generous and
    // makes results unexplainable — a row matches for a reason you can't see.
    where.merchant = { contains: filters.q, mode: "insensitive" };
  }

  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      // Dates are @db.Date at UTC midnight, so an inclusive "to" is lte the
      // day itself — no end-of-day arithmetic, and no row lost on the boundary.
      ...(filters.to ? { lte: new Date(`${filters.to}T00:00:00.000Z`) } : {}),
    };
  }

  // `in` with one element is the same query plan as equality, so single and
  // multi select need no separate code path.
  if (filters.status.length > 0) where.status = { in: filters.status };
  if (filters.categoryId.length > 0) where.categoryId = { in: filters.categoryId };
  if (filters.projectId.length > 0) where.projectId = { in: filters.projectId };

  // Department belongs to the expense's owner, not the expense.
  if (filters.departmentId.length > 0) {
    where.user = { departmentId: { in: filters.departmentId } };
  }

  if (filters.userId.length > 0) where.userId = { in: filters.userId };

  return where;
}

/**
 * Combine a scope predicate with user-chosen filters so the filters can only
 * ever narrow it. THE way a screen builds a filtered expense query.
 */
export function applyExpenseFilters(scope: Where, filters: ExpenseFilters): Where {
  const filterWhere = buildExpenseListWhere(filters);
  if (Object.keys(filterWhere).length === 0) return { ...scope };
  return { ...scope, AND: [filterWhere] };
}

/**
 * The expense list's sort order — and the reason it has three keys.
 *
 * ── A PAGINATED SORT MUST BE A TOTAL ORDER ────────────────────────────────
 * This was `[{ date: "desc" }, { createdAt: "desc" }]`, which is a total
 * order only while no two expenses share both. Bulk paths break that
 * routinely: a card import or a `createMany` writes dozens of rows with the
 * same `createdAt`, and expense dates repeat by nature. Postgres is then free
 * to return tied rows in a different order for each `OFFSET`, so paging
 * through the list can show one row twice and never show another.
 *
 * That is not a cosmetic glitch. §7.4 requires a KPI to equal the total of
 * the table it opens, and the reader adds that table up one page at a time —
 * over an unstable sort the two genuinely disagree. Found by
 * tests/isolation/dashboard-kpi.test.ts: an org-wide card read 258,345 while
 * walking its own list gave 255,545.
 *
 * `id` is unique, so appending it makes the order total and every page
 * boundary deterministic. Exported so the list, the dashboard and the tests
 * that walk them cannot sort differently.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const EXPENSE_LIST_ORDER = [
  { date: "desc" as const },
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

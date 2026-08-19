// Expense KPIs (D1.4).
//
// §7.4: "every KPI clicks through to its filtered table — the number and the
// list must always agree."
//
// That sentence is a constraint on the CODE, not a note to be careful. It
// holds here because a KPI and its link are produced from the same place: the
// total is a groupBy over the screen's where-clause, and the href is that
// same filter serialised with one status added. Neither can be edited without
// the other. tests/isolation/expense-stats.test.ts then proves it against a
// real database by summing every page of the linked list and comparing.
//
// The trap this avoids: computing the KPI from an aggregate over the whole
// filtered set while the table renders only the first N rows. The two look
// right in development and disagree the moment anyone has more expenses than
// the cap — which is why the list is server-paginated over the same set.
import {
  EXPENSE_STATUSES,
  expenseFiltersToParams,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";
import { statusEntry } from "@/lib/design/status";

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/** One row of `groupBy({ by: ["status"], _sum: { baseAmount }, _count })`. */
export type StatusGroup = {
  status: string;
  _sum: { baseAmount: number | null };
  _count: { _all: number };
};

export type ExpenseStat = {
  /** "total", or one of the expense statuses. */
  key: "total" | ExpenseStatus;
  label: string;
  /** Integer minor units, org base currency. */
  total: number;
  count: number;
  /** The filters that produce EXACTLY the rows behind this number. */
  filters: ExpenseFilters;
  /** Where the card links. Always agrees with `filters`. */
  href: string;
};

/** Which statuses earn a card. Not all five — a KPI strip is a summary, and
 *  five equal cards summarise nothing. */
export const STAT_STATUSES: ExpenseStatus[] = ["draft", "submitted", "reimbursed"];

/**
 * Build the href for a KPI: the screen's current filters, narrowed to one
 * status. Page is deliberately dropped — following a KPI should land on page
 * one of its list, not on whatever page you happened to be reading.
 */
export function statHref(base: ExpenseFilters, status?: ExpenseStatus): string {
  const filters: ExpenseFilters = status ? { ...base, status: [status] } : base;
  const query = expenseFiltersToParams(filters).toString();
  return query ? `/expenses?${query}` : "/expenses";
}

/**
 * Turn a status groupBy into the KPI strip.
 *
 * `groups` must come from the SAME where-clause the table uses. Totals sum
 * baseAmount (org currency) rather than amount, so a card never adds rupees
 * to dollars — the one arithmetic error a multi-currency expense tool is
 * guaranteed to make if nobody says otherwise.
 */
export function buildExpenseStats(
  groups: StatusGroup[],
  base: ExpenseFilters
): ExpenseStat[] {
  const byStatus = new Map<string, { total: number; count: number }>();
  for (const g of groups) {
    byStatus.set(g.status, {
      total: g._sum.baseAmount ?? 0,
      count: g._count._all,
    });
  }

  const grandTotal = groups.reduce((sum, g) => sum + (g._sum.baseAmount ?? 0), 0);
  const grandCount = groups.reduce((sum, g) => sum + g._count._all, 0);

  const stats: ExpenseStat[] = [
    {
      key: "total",
      label: "Total in view",
      total: grandTotal,
      count: grandCount,
      filters: base,
      href: statHref(base),
    },
  ];

  for (const status of STAT_STATUSES) {
    const entry = byStatus.get(status) ?? { total: 0, count: 0 };
    stats.push({
      key: status,
      // Same label the badge uses, so the card and the rows it opens name the
      // state identically.
      label: statusEntry(status).label,
      total: entry.total,
      count: entry.count,
      filters: { ...base, status: [status] },
      href: statHref(base, status),
    });
  }

  return stats;
}

/** "12 expenses" / "1 expense" — the hint under a KPI value. */
export function countHint(count: number): string {
  return `${count} expense${count === 1 ? "" : "s"}`;
}

/** Zero-based page index from the URL, clamped to something sane. */
export function parsePageIndex(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  return n - 1;
}

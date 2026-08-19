// Dashboard KPIs (D3.3) — §7.4's "the number and the list must always agree".
//
// The strongest form of that check needs a database and lives in
// tests/isolation/dashboard-kpi.test.ts, which follows each href and sums the
// rows. What CAN be proven without one, and is proven here, is that the href
// a card carries round-trips back to exactly the filter state its number was
// summed over — so the two can never describe different sets.
import { describe, expect, it } from "vitest";

import {
  buildApproverKpis,
  buildEmployeeKpis,
  buildFinanceKpis,
  expenseListHref,
  kpiNotes,
  monthOverMonthDelta,
  type DashboardKpi,
} from "@/lib/domain/dashboard-kpi";
import type { StatusGroup } from "@/lib/domain/expense-stats";
import {
  EMPTY_EXPENSE_FILTERS,
  parseExpenseFilters,
  searchParamsToRecord,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";

const CURRENCY = "INR";

const GROUPS: StatusGroup[] = [
  { status: "draft", _sum: { baseAmount: 10_000 }, _count: { _all: 2 } },
  { status: "submitted", _sum: { baseAmount: 25_000 }, _count: { _all: 3 } },
  { status: "approved", _sum: { baseAmount: 40_000 }, _count: { _all: 4 } },
  { status: "reimbursed", _sum: { baseAmount: 5_000 }, _count: { _all: 1 } },
];
const GRAND_TOTAL = 80_000;

const FILTERS: ExpenseFilters = {
  ...EMPTY_EXPENSE_FILTERS,
  from: "2026-07-01",
  to: "2026-07-31",
  categoryId: ["11111111-1111-4111-8111-111111111111"],
};

const MONTHLY = [{ total: 20_000 }, { total: 30_000 }];

/** Read an href back into the filter state it encodes. */
function filtersFromHref(href: string): {
  filters: ExpenseFilters;
  scope: string | null;
} {
  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  const scope = params.get("scope");
  params.delete("scope");
  return { filters: parseExpenseFilters(searchParamsToRecord(params)), scope };
}

describe("expenseListHref", () => {
  it("round-trips the filters it was given", () => {
    expect(filtersFromHref(expenseListHref(FILTERS)).filters).toEqual(FILTERS);
  });

  it("omits scope for 'mine' — the default needs no parameter", () => {
    expect(expenseListHref(FILTERS, { scope: "mine" })).not.toContain("scope");
    expect(expenseListHref(FILTERS, { scope: "org" })).toContain("scope=org");
  });

  it("is a clean /expenses when nothing is filtered", () => {
    expect(expenseListHref(EMPTY_EXPENSE_FILTERS)).toBe("/expenses");
  });

  it("replaces the status rather than adding to it", () => {
    // A card for "submitted" must open submitted expenses, not submitted
    // plus whatever the reader had already ticked.
    const withStatus: ExpenseFilters = { ...FILTERS, status: ["draft", "rejected"] };
    const { filters } = filtersFromHref(
      expenseListHref(withStatus, { status: "submitted" })
    );
    expect(filters.status).toEqual(["submitted"]);
  });
});

/** Every exact card: does its href describe the set its number came from? */
function assertExactCardsAgree(kpis: DashboardKpi[], scope: string | null) {
  for (const kpi of kpis) {
    if (kpi.agreement.kind !== "exact") continue;
    if (!kpi.agreement.href.startsWith("/expenses")) continue; // queue cards
    const { filters, scope: hrefScope } = filtersFromHref(kpi.agreement.href);

    expect(hrefScope, kpi.key).toBe(scope);
    // Everything except status must survive untouched — a card may narrow the
    // status, never quietly drop the reader's date range or category.
    expect({ ...filters, status: [] }, kpi.key).toEqual({ ...FILTERS, status: [] });

    // And the status in the href must be the one the number was sliced by.
    const expected = kpi.key === "total" ? [] : [kpi.key];
    expect(filters.status, kpi.key).toEqual(expected);
  }
}

describe("buildEmployeeKpis", () => {
  const kpis = buildEmployeeKpis({
    groups: GROUPS,
    filters: FILTERS,
    currency: CURRENCY,
    monthly: MONTHLY,
  });

  it("sums the whole groupBy for the total and one status for the rest", () => {
    expect(kpis.find((k) => k.key === "total")?.value).toBe(GRAND_TOTAL);
    expect(kpis.find((k) => k.key === "submitted")?.value).toBe(25_000);
    expect(kpis.find((k) => k.key === "approved")?.value).toBe(40_000);
    expect(kpis.find((k) => k.key === "draft")?.value).toBe(10_000);
  });

  it("links every card to the rows behind it, at the reader's own scope", () => {
    assertExactCardsAgree(kpis, null);
  });

  it("has nothing to footnote — every number is a filtered expense sum", () => {
    expect(kpiNotes(kpis)).toEqual([]);
  });

  it("counts expenses, not rupees, in the hint", () => {
    expect(kpis.find((k) => k.key === "submitted")?.hint).toBe("3 expenses");
    expect(kpis.find((k) => k.key === "reimbursed" || k.key === "draft")?.hint).toBe(
      "2 expenses"
    );
  });
});

describe("buildApproverKpis", () => {
  const kpis = buildApproverKpis({
    groups: GROUPS,
    filters: FILTERS,
    currency: CURRENCY,
    monthly: MONTHLY,
    queue: { count: 3, total: 99_000, flagged: 1 },
  });

  it("leads with the queue, taken straight from approvalQueueFor", () => {
    // Not recomputed from expenses: /approvals lists REPORTS, and a card that
    // counted expenses would show a number the queue never displays.
    const queue = kpis[0];
    expect(queue.key).toBe("queue");
    expect(queue.value).toBe(99_000);
    expect(queue.agreement.href).toBe("/approvals");
    expect(queue.hint).toContain("1 flagged");
  });

  it("scopes every expense card to the team", () => {
    assertExactCardsAgree(kpis, "team");
  });
});

describe("buildFinanceKpis", () => {
  const kpis = buildFinanceKpis({
    groups: GROUPS,
    filters: FILTERS,
    currency: CURRENCY,
    monthly: MONTHLY,
    payable: { count: 7, outstanding: 123_400 },
  });

  it("is the four cards §7.4 names, in that order", () => {
    expect(kpis.map((k) => k.key)).toEqual([
      "total",
      "submitted",
      "approved",
      "outstanding",
    ]);
  });

  it("scopes every expense card to the org", () => {
    assertExactCardsAgree(kpis, "org");
  });

  it("marks 'outstanding to employees' as computed differently, with a reason", () => {
    // The one figure on any dashboard that is not an expense sum. If this
    // ever silently became "exact", a reader would follow it to /finance and
    // find a total that doesn't match — and stop trusting the other three.
    const outstanding = kpis.find((k) => k.key === "outstanding");
    expect(outstanding?.value).toBe(123_400);
    expect(outstanding?.agreement.kind).toBe("different");
    expect(outstanding?.agreement.href).toBe("/finance");

    const notes = kpiNotes(kpis);
    expect(notes).toHaveLength(1);
    expect(notes[0].label).toBe("Outstanding to employees");
    expect(notes[0].note.length).toBeGreaterThan(40);
  });
});

describe("monthOverMonthDelta", () => {
  it("is the percentage change between the last two months", () => {
    expect(monthOverMonthDelta([{ total: 200 }, { total: 250 }])).toBeCloseTo(25);
    expect(monthOverMonthDelta([{ total: 200 }, { total: 150 }])).toBeCloseTo(-25);
  });

  it("declines to invent a comparison against zero", () => {
    // Nothing → something is not "+100%" and not "+∞". A delta chip that
    // appears out of nowhere the first time a figure is non-zero teaches the
    // reader to ignore delta chips.
    expect(monthOverMonthDelta([{ total: 0 }, { total: 5_000 }])).toBeNull();
    expect(monthOverMonthDelta([{ total: 5_000 }])).toBeNull();
    expect(monthOverMonthDelta([])).toBeNull();
  });

  it("reads spend growth as bad news", () => {
    const kpis = buildEmployeeKpis({
      groups: GROUPS,
      filters: FILTERS,
      currency: CURRENCY,
      monthly: MONTHLY,
    });
    expect(kpis[0].delta?.goodDirection).toBe("down");
    expect(kpis[0].delta?.percent).toBeCloseTo(50);
  });
});

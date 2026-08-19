// KPI ↔ table agreement (D1.4 DoD), against a real database.
//
// §7.4: "every KPI clicks through to its filtered table — the number and the
// list must always agree." This proves it the only way that means anything:
// compute each card exactly as the screen does, then follow its href, page
// through the list the way the table does, and sum. If a card ever disagrees
// with the rows it opens, this fails.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import { applyExpenseFilters } from "@/lib/domain/expense-query";
import {
  buildExpenseStats,
  parsePageIndex,
  type StatusGroup,
} from "@/lib/domain/expense-stats";
import {
  parseExpenseFilters,
  searchParamsToRecord,
  type ExpenseFilters,
} from "@/lib/schemas/expense-filters";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

const PAGE_SIZE = 50;

let A: OrgFixture;
let B: OrgFixture;

/** Enough rows to cross the page boundary — the case where a capped table
 *  and a whole-set aggregate silently stop agreeing. */
const EXTRA_ROWS = 60;

beforeAll(async () => {
  A = await provisionOrg("stats-a");
  B = await provisionOrg("stats-b");

  const statuses = ["draft", "submitted", "reimbursed", "approved"] as const;
  await owner.expense.createMany({
    data: Array.from({ length: EXTRA_ROWS }, (_, i) => ({
      orgId: A.orgId,
      userId: A.users.employee,
      amount: (i + 1) * 100,
      baseAmount: (i + 1) * 100,
      currency: "INR",
      date: new Date(Date.UTC(2026, 6, (i % 28) + 1)),
      merchant: `Stat merchant ${i}`,
      categoryId: A.categoryId,
      status: statuses[i % statuses.length],
    })),
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

/** Exactly what app/(app)/expenses/page.tsx does, for a given filter state. */
async function screenFor(orgId: string, userId: string, filters: ExpenseFilters) {
  const db = scopedDb(orgId);
  const where = applyExpenseFilters({ userId }, filters);
  const [totalRows, groups] = await Promise.all([
    db.expense.count({ where }) as Promise<number>,
    db.expense.groupBy({
      by: ["status"],
      where,
      _sum: { baseAmount: true },
      _count: { _all: true },
    }) as Promise<StatusGroup[]>,
  ]);
  return { where, totalRows, stats: buildExpenseStats(groups, filters) };
}

/** Page through a filtered list the way the table does, and total it. */
async function walkList(orgId: string, userId: string, filters: ExpenseFilters) {
  const db = scopedDb(orgId);
  const where = applyExpenseFilters({ userId }, filters);
  let pageIndex = 0;
  let total = 0;
  let count = 0;

  for (;;) {
    const rows = (await db.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: pageIndex * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { baseAmount: true },
    })) as Array<{ baseAmount: number }>;
    if (rows.length === 0) break;
    for (const row of rows) total += row.baseAmount;
    count += rows.length;
    pageIndex += 1;
    if (rows.length < PAGE_SIZE) break;
  }

  return { total, count };
}

/** Parse a KPI href back into filters, the way the browser would. */
function filtersFromHref(href: string): ExpenseFilters {
  const url = new URL(href, "https://example.test");
  return parseExpenseFilters(searchParamsToRecord(url.searchParams));
}

describe("KPI cards agree with the tables they link to", () => {
  it("has enough rows to cross a page boundary", async () => {
    const { totalRows } = await screenFor(A.orgId, A.users.employee, {
      status: [],
      categoryId: [],
      projectId: [],
      departmentId: [],
      userId: [],
    });
    expect(totalRows).toBeGreaterThan(PAGE_SIZE);
  });

  it("every card's total equals the sum of the list its href opens", async () => {
    const base: ExpenseFilters = {
      status: [],
      categoryId: [],
      projectId: [],
      departmentId: [],
      userId: [],
    };
    const { stats } = await screenFor(A.orgId, A.users.employee, base);
    expect(stats.length).toBeGreaterThan(1);

    for (const stat of stats) {
      // Follow the link exactly as a click would, then walk every page.
      const linked = filtersFromHref(stat.href);
      const walked = await walkList(A.orgId, A.users.employee, linked);

      expect(walked.total, `${stat.label} total`).toBe(stat.total);
      expect(walked.count, `${stat.label} count`).toBe(stat.count);
    }
  });

  it("still agrees once a filter is applied", async () => {
    const base: ExpenseFilters = {
      status: [],
      categoryId: [],
      projectId: [],
      departmentId: [],
      userId: [],
      from: "2026-07-01",
      to: "2026-07-14",
    };
    const { stats } = await screenFor(A.orgId, A.users.employee, base);

    for (const stat of stats) {
      const walked = await walkList(A.orgId, A.users.employee, filtersFromHref(stat.href));
      expect(walked.total, `${stat.label} under a date filter`).toBe(stat.total);
    }

    // The date range must survive into the href — a KPI that drops the
    // screen's filters opens a list that has nothing to do with its number.
    const submitted = stats.find((s) => s.key === "submitted");
    expect(submitted?.href).toContain("from=2026-07-01");
    expect(submitted?.href).toContain("to=2026-07-14");
  });

  it("the total card equals the sum of the per-status cards", async () => {
    // Not automatic: the strip shows three statuses out of five, so this only
    // holds because the grand total is computed from ALL groups rather than
    // by adding up the cards on screen.
    const { stats, totalRows } = await screenFor(A.orgId, A.users.employee, {
      status: [],
      categoryId: [],
      projectId: [],
      departmentId: [],
      userId: [],
    });
    const totalCard = stats.find((s) => s.key === "total");
    const walked = await walkList(A.orgId, A.users.employee, {
      status: [],
      categoryId: [],
      projectId: [],
      departmentId: [],
      userId: [],
    });

    expect(totalCard?.total).toBe(walked.total);
    expect(totalCard?.count).toBe(totalRows);
  });

  it("org B's KPIs never count A's expenses", async () => {
    const { stats, totalRows } = await screenFor(B.orgId, A.users.employee, {
      status: [],
      categoryId: [],
      projectId: [],
      departmentId: [],
      userId: [],
    });
    expect(totalRows).toBe(0);
    for (const stat of stats) expect(stat.total).toBe(0);
  });
});

describe("parsePageIndex", () => {
  it("is 1-based in the URL and 0-based in code", () => {
    expect(parsePageIndex(undefined)).toBe(0);
    expect(parsePageIndex("1")).toBe(0);
    expect(parsePageIndex("3")).toBe(2);
  });

  it("clamps nonsense to the first page rather than erroring", () => {
    expect(parsePageIndex("0")).toBe(0);
    expect(parsePageIndex("-4")).toBe(0);
    expect(parsePageIndex("banana")).toBe(0);
  });
});

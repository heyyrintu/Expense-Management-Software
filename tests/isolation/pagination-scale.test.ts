// Pagination at scale (D5.4) — 200 rows, against a real database.
//
// ── WHAT THIS IS ACTUALLY TESTING ─────────────────────────────────────────
// Not "is it fast". It is testing that server pagination stays CORRECT once
// there is more data than fits on a page — which is a different property and
// the one that silently breaks.
//
// D3.3 found the failure this guards: the expense list sorted by
// `date, createdAt`, both of which bulk-created rows share, so tied rows
// shuffled between pages. Page 2 repeated a row page 1 had already shown and
// dropped one nobody ever saw. Sixty rows was enough to expose it; two
// hundred makes it certain.
//
// So the assertion is: walk every page, collect the ids, and require exactly
// 200 DISTINCT ids. A capped table plus an uncapped KPI would also show up
// here, because the totals are compared against the same set.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import { applyExpenseFilters, EXPENSE_LIST_ORDER } from "@/lib/domain/expense-query";
import { buildExpenseStats, type StatusGroup } from "@/lib/domain/expense-stats";
import { EMPTY_EXPENSE_FILTERS } from "@/lib/schemas/expense-filters";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

/** The list's real page size (app/(app)/expenses/expenses-table.tsx). */
const PAGE_SIZE = 50;
const ROWS = 200;

let A: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("scale");

  // Deliberately COLLIDING sort keys: 200 rows across 28 dates, all created
  // in one statement so `createdAt` is identical. This is the shape a card
  // import or a WhatsApp batch produces, and the shape that breaks an
  // unstable sort.
  const statuses = ["draft", "submitted", "approved", "reimbursed"] as const;
  await owner.expense.createMany({
    data: Array.from({ length: ROWS }, (_, i) => ({
      orgId: A.orgId,
      userId: A.users.employee,
      amount: (i + 1) * 100,
      baseAmount: (i + 1) * 100,
      currency: "INR",
      date: new Date(Date.UTC(2026, 6, (i % 28) + 1)),
      merchant: `Scale merchant ${i}`,
      categoryId: A.categoryId,
      status: statuses[i % statuses.length],
    })),
  });
}, 60_000);

afterAll(async () => {
  await teardownOrgs([A.orgId]);
  await owner.$disconnect();
});

const where = () =>
  applyExpenseFilters({ userId: A.users.employee }, EMPTY_EXPENSE_FILTERS);

/** Page through exactly as the list does, collecting ids. */
async function walkPages() {
  const db = scopedDb(A.orgId);
  const ids: string[] = [];
  const pageSizes: number[] = [];
  let pageIndex = 0;

  for (;;) {
    const rows = (await db.expense.findMany({
      where: where(),
      orderBy: EXPENSE_LIST_ORDER,
      skip: pageIndex * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true },
    })) as Array<{ id: string }>;
    if (rows.length === 0) break;
    ids.push(...rows.map((r) => r.id));
    pageSizes.push(rows.length);
    pageIndex += 1;
    if (rows.length < PAGE_SIZE) break;
  }

  return { ids, pageSizes, pages: pageIndex };
}

describe("server pagination holds at 200 rows", () => {
  it("has more rows than one page, or the test proves nothing", async () => {
    const total = (await scopedDb(A.orgId).expense.count({
      where: where(),
    })) as number;
    // +1 for the fixture expense provisionOrg creates.
    expect(total).toBe(ROWS + 1);
    expect(total).toBeGreaterThan(PAGE_SIZE);
  });

  it("returns exactly one page at a time", async () => {
    const { pageSizes } = await walkPages();
    // 201 rows: four full pages plus a remainder.
    expect(pageSizes.slice(0, -1).every((n) => n === PAGE_SIZE)).toBe(true);
    expect(pageSizes.at(-1)).toBeLessThanOrEqual(PAGE_SIZE);
  });

  it("shows every row exactly once — no repeats, no drops", async () => {
    // THE assertion. Under an unstable sort this fails with duplicates on one
    // page and rows that never appear on any.
    const { ids } = await walkPages();
    expect(ids).toHaveLength(ROWS + 1);
    expect(new Set(ids).size).toBe(ROWS + 1);
  });

  it("is stable across repeated walks", async () => {
    // Same query, twice: an unstable ORDER BY can return a different
    // arrangement each time, so one pass agreeing with itself is not enough.
    const first = await walkPages();
    const second = await walkPages();
    expect(second.ids).toEqual(first.ids);
  });

  it("the KPI strip still equals the rows it opens", async () => {
    // §7.4 at scale. The trap: cards summing the whole set while the table
    // shows the first page. Both are computed from one where-clause here, so
    // this is the check that they stay that way.
    const groups = (await scopedDb(A.orgId).expense.groupBy({
      by: ["status"],
      where: where(),
      _sum: { baseAmount: true },
      _count: { _all: true },
    })) as StatusGroup[];

    const stats = buildExpenseStats(groups, EMPTY_EXPENSE_FILTERS);
    const total = stats.find((s) => s.key === "total");

    const { ids } = await walkPages();
    expect(total?.count).toBe(ids.length);

    const rows = (await scopedDb(A.orgId).expense.findMany({
      where: where(),
      select: { baseAmount: true },
    })) as Array<{ baseAmount: number }>;
    expect(total?.total).toBe(rows.reduce((sum, r) => sum + r.baseAmount, 0));
  });

  it("a full page query stays well under a second", async () => {
    // Not a benchmark — a smoke alarm. A missing index on (org_id, user_id,
    // date) turns this from milliseconds into seconds, and that is the kind
    // of regression nobody notices until a real tenant has real data.
    const started = Date.now();
    await scopedDb(A.orgId).expense.findMany({
      where: where(),
      orderBy: EXPENSE_LIST_ORDER,
      skip: 3 * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, baseAmount: true, date: true, merchant: true },
    });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

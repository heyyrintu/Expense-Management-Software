// Isolation for the D1.3 filtered expense query.
//
// The filter bar added a new query shape — scope ANDed with user-chosen
// predicates — and CLAUDE.md is unconditional: every new query gets a case
// here. Two things to prove: org B still cannot see org A's expenses through
// a filtered read, and a user facet cannot widen the pinned scope.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import { applyExpenseFilters } from "@/lib/domain/expense-query";
import { EMPTY_EXPENSE_FILTERS } from "@/lib/schemas/expense-filters";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("filt-a");
  B = await provisionOrg("filt-b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("filtered expense list", () => {
  it("B cannot reach A's expenses through an unfiltered read", async () => {
    const rows = (await scopedDb(B.orgId).expense.findMany({
      where: applyExpenseFilters({ userId: A.users.employee }, EMPTY_EXPENSE_FILTERS),
    })) as Array<{ id: string }>;
    expect(rows).toHaveLength(0);
  });

  it("B cannot reach A's expenses through any filter combination", async () => {
    const rows = (await scopedDb(B.orgId).expense.findMany({
      where: applyExpenseFilters(
        { userId: A.users.employee },
        {
          ...EMPTY_EXPENSE_FILTERS,
          status: ["draft", "submitted", "approved", "rejected", "reimbursed"],
          from: "2000-01-01",
          to: "2100-01-01",
        }
      ),
    })) as Array<{ id: string }>;
    expect(rows).toHaveLength(0);
  });

  it("a user facet cannot widen the pinned scope", async () => {
    // Two users inside the SAME org: the facet names the approver, the scope
    // pins the employee. AND means the intersection — nothing — rather than
    // the facet replacing the pin and handing over the approver's rows.
    const where = applyExpenseFilters(
      { userId: A.users.employee },
      { ...EMPTY_EXPENSE_FILTERS, userId: [A.users.approver] }
    );
    const rows = (await scopedDb(A.orgId).expense.findMany({ where })) as Array<{
      userId: string;
    }>;
    expect(rows).toHaveLength(0);
  });

  it("a filter narrows within the caller's own scope", async () => {
    const db = scopedDb(A.orgId);
    const all = (await db.expense.findMany({
      where: applyExpenseFilters({ userId: A.users.employee }, EMPTY_EXPENSE_FILTERS),
    })) as Array<{ id: string; merchant: string; userId: string }>;
    expect(all.length).toBeGreaterThan(0);
    for (const row of all) expect(row.userId).toBe(A.users.employee);

    const noMatch = (await db.expense.findMany({
      where: applyExpenseFilters(
        { userId: A.users.employee },
        { ...EMPTY_EXPENSE_FILTERS, q: "zzz-no-such-merchant" }
      ),
    })) as Array<{ id: string }>;
    expect(noMatch).toHaveLength(0);
  });

  it("search matches case-insensitively inside the org only", async () => {
    const fixtureMerchant = (
      (await owner.expense.findUnique({
        where: { id: A.expenseId },
        select: { merchant: true },
      })) as { merchant: string } | null
    )?.merchant;
    expect(fixtureMerchant).toBeTruthy();

    const hits = (await scopedDb(A.orgId).expense.findMany({
      where: applyExpenseFilters(
        { userId: A.users.employee },
        { ...EMPTY_EXPENSE_FILTERS, q: fixtureMerchant!.toUpperCase() }
      ),
    })) as Array<{ id: string }>;
    expect(hits.length).toBeGreaterThan(0);

    // The same search from org B returns nothing, even though the merchant
    // string exists in the database.
    const crossOrg = (await scopedDb(B.orgId).expense.findMany({
      where: applyExpenseFilters(
        { userId: B.users.employee },
        { ...EMPTY_EXPENSE_FILTERS, q: fixtureMerchant!.toUpperCase() }
      ),
    })) as Array<{ id: string }>;
    expect(crossOrg).toHaveLength(0);
  });
});

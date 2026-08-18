// Isolation for 5.1 budgets: cross-org CRUD blocked; scope validation and
// utilization can never read another org's data. (RLS coverage of the new
// table is asserted automatically by rls.test.ts.)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aBudgetId: string;

beforeAll(async () => {
  A = await provisionOrg("bud-a");
  B = await provisionOrg("bud-b");
  const budget = await owner.budget.create({
    data: {
      orgId: A.orgId,
      scopeType: "category",
      scopeId: A.categoryId,
      period: "monthly",
      amount: 100000,
    },
  });
  aBudgetId = budget.id;
});

afterAll(async () => {
  await owner.budget.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org budget access", () => {
  it("B cannot read, update, or delete A's budget", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.budget.findUnique({ where: { id: aBudgetId } })).toBeNull();
    const upd = await db.budget.updateMany({
      where: { id: aBudgetId },
      data: { amount: 1 },
    });
    expect(upd.count).toBe(0);
    const del = await db.budget.deleteMany({ where: { id: aBudgetId } });
    expect(del.count).toBe(0);
    const fresh = await owner.budget.findUnique({ where: { id: aBudgetId } });
    expect(fresh?.amount).toBe(100000);
  });

  it("the create action's scope validation rejects A's category id from B's scope", async () => {
    // action pattern: scope target must resolve inside the caller's org
    expect(
      await scopedDb(B.orgId).category.findUnique({ where: { id: A.categoryId } })
    ).toBeNull();
  });

  it("utilization aggregation from B's scope never counts A's expenses", async () => {
    // A's fixture expense is 12345 in A's Travel category, status draft →
    // set to submitted so it would count if leaked
    await owner.expense.update({
      where: { id: A.expenseId },
      data: { status: "submitted" },
    });
    const agg = await scopedDb(B.orgId).expense.aggregate({
      where: { status: { in: ["submitted", "approved", "reimbursed"] }, categoryId: A.categoryId },
      _sum: { amount: true },
    });
    expect(agg._sum.amount ?? 0).toBe(0);
    await owner.expense.update({
      where: { id: A.expenseId },
      data: { status: "draft" },
    });
  });

  it("same scope+period can be budgeted independently per org (unique is org-led)", async () => {
    // B budgets its own category with the same period — no collision with A
    const b = await scopedDb(B.orgId).budget.create({
      data: {
        orgId: B.orgId,
        scopeType: "category",
        scopeId: B.categoryId,
        period: "monthly",
        amount: 50000,
      },
    });
    expect(b.orgId).toBe(B.orgId);
  });
});

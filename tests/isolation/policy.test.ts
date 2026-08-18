// Isolation for the policy evaluator (3.1/3.2): context gathering runs
// entirely inside the caller's org scope.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeExpenseFlags } from "@/lib/domain/policy-eval";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("pol-a");
  B = await provisionOrg("pol-b");
  // tight limits on A's category so in-org evaluation clearly flags
  await owner.category.update({
    where: { id: A.categoryId },
    data: { perExpenseLimit: 1000, receiptRequiredAbove: 500 },
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("evaluator scoping", () => {
  it("A's own evaluation sees the category limits and flags", async () => {
    const flags = await computeExpenseFlags(scopedDb(A.orgId), A.orgId, {
      expenseId: null,
      userId: A.users.employee,
      amount: 2000,
      baseAmount: 2000,
      date: new Date("2026-08-10T00:00:00.000Z"),
      merchant: "Fresh Cafe",
      categoryId: A.categoryId,
      receiptCount: 0,
    });
    const rules = flags.map((f) => f.rule);
    expect(rules).toContain("per_expense_limit");
    expect(rules).toContain("receipt_required");
  });

  it("A's category id evaluated from B's scope resolves to no category — its limits never leak", async () => {
    const flags = await computeExpenseFlags(scopedDb(B.orgId), B.orgId, {
      expenseId: null,
      userId: B.users.employee,
      amount: 2000,
      baseAmount: 2000,
      date: new Date("2026-08-10T00:00:00.000Z"),
      merchant: "Fresh Cafe",
      categoryId: A.categoryId, // cross-org id
      receiptCount: 0,
    });
    expect(flags.map((f) => f.rule)).not.toContain("per_expense_limit");
    expect(flags.map((f) => f.rule)).not.toContain("receipt_required");
  });

  it("duplicate detection never sees another org's expenses", async () => {
    // A has the fixture expense (12345, 2026-08-01, 'pol-a Cafe')
    const flags = await computeExpenseFlags(scopedDb(B.orgId), B.orgId, {
      expenseId: null,
      userId: B.users.employee,
      amount: 12345,
      baseAmount: 12345,
      date: new Date("2026-08-01T00:00:00.000Z"),
      merchant: "pol-a Cafe",
      categoryId: B.categoryId,
      receiptCount: 1,
    });
    expect(flags.map((f) => f.rule)).not.toContain("duplicate");
  });
});

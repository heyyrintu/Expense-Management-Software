// Isolation for 1.2 expense CRUD: cross-ORG via scopedDb, plus the
// cross-USER ownership pin ({id, userId, status}) used by the actions.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("exp-a");
  B = await provisionOrg("exp-b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org expense CRUD", () => {
  it("B cannot update or delete A's expense via the action's where-pattern", async () => {
    const db = scopedDb(B.orgId);
    const upd = await db.expense.updateMany({
      where: { id: A.expenseId, userId: B.users.employee, status: "draft" },
      data: { merchant: "hijack" },
    });
    expect(upd.count).toBe(0);
    const del = await db.expense.deleteMany({
      where: { id: A.expenseId, userId: B.users.employee, status: "draft" },
    });
    expect(del.count).toBe(0);
    const fresh = await owner.expense.findUnique({ where: { id: A.expenseId } });
    expect(fresh?.merchant).toBe("exp-a Cafe");
  });

  it("an expense cannot reference another org's category (validated via scoped read)", async () => {
    // the create action resolves the category through scopedDb first —
    // A's category id resolves to null in B's scope
    expect(
      await scopedDb(B.orgId).category.findUnique({ where: { id: A.categoryId } })
    ).toBeNull();
  });
});

describe("cross-user ownership within one org", () => {
  it("another user in the SAME org cannot edit or delete my draft", async () => {
    const db = scopedDb(A.orgId);
    // fixture expense belongs to A.users.employee; approver tries to touch it
    const upd = await db.expense.updateMany({
      where: { id: A.expenseId, userId: A.users.approver, status: "draft" },
      data: { merchant: "insider" },
    });
    expect(upd.count).toBe(0);
    const del = await db.expense.deleteMany({
      where: { id: A.expenseId, userId: A.users.approver, status: "draft" },
    });
    expect(del.count).toBe(0);
  });

  it("my-expenses list shows only the session user's expenses", async () => {
    const rows = await scopedDb(A.orgId).expense.findMany({
      where: { userId: A.users.approver },
    });
    expect(rows.length).toBe(0); // fixture expense belongs to the employee
  });
});

describe("status pin", () => {
  it("a non-draft expense cannot be updated through the action's where-pattern", async () => {
    await owner.expense.update({
      where: { id: B.expenseId },
      data: { status: "submitted" },
    });
    const upd = await scopedDb(B.orgId).expense.updateMany({
      where: { id: B.expenseId, userId: B.users.employee, status: "draft" },
      data: { merchant: "late edit" },
    });
    expect(upd.count).toBe(0);
    await owner.expense.update({
      where: { id: B.expenseId },
      data: { status: "draft" },
    });
  });
});

// Cross-tenant isolation through scopedDb (the only sanctioned data path).
// Pattern: create as org A → attempt access as org B → must fail closed.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("a");
  B = await provisionOrg("b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("read leak", () => {
  it("B cannot fetch A's expense by id (not-found, not permission error)", async () => {
    expect(await scopedDb(B.orgId).expense.findUnique({ where: { id: A.expenseId } })).toBeNull();
    expect(await scopedDb(A.orgId).expense.findUnique({ where: { id: A.expenseId } })).not.toBeNull();
  });

  it("B cannot fetch A's report, receipt, user, or category by id", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.expenseReport.findUnique({ where: { id: A.reportId } })).toBeNull();
    expect(await db.receipt.findUnique({ where: { id: A.receiptId } })).toBeNull();
    expect(await db.user.findUnique({ where: { id: A.users.employee } })).toBeNull();
    expect(await db.category.findUnique({ where: { id: A.categoryId } })).toBeNull();
  });

  it("B cannot read A's organization row", async () => {
    expect(
      await scopedDb(B.orgId).organization.findUnique({ where: { id: A.orgId } })
    ).toBeNull();
  });
});

describe("write leak", () => {
  it("B cannot update A's expense; A's record is unchanged", async () => {
    await expect(
      scopedDb(B.orgId).expense.update({
        where: { id: A.expenseId },
        data: { merchant: "hacked" },
      })
    ).rejects.toThrow(); // P2025 not-found — existence not confirmed
    const fresh = await owner.expense.findUnique({ where: { id: A.expenseId } });
    expect(fresh?.merchant).toBe("a Cafe");
  });

  it("B cannot delete A's receipt", async () => {
    await expect(
      scopedDb(B.orgId).receipt.delete({ where: { id: A.receiptId } })
    ).rejects.toThrow();
    expect(await owner.receipt.findUnique({ where: { id: A.receiptId } })).not.toBeNull();
  });

  it("B's bulk update cannot touch A's rows", async () => {
    const res = await scopedDb(B.orgId).expense.updateMany({
      data: { purpose: "bulk" },
    });
    expect(res.count).toBe(1); // only B's own fixture expense
    const a = await owner.expense.findUnique({ where: { id: A.expenseId } });
    expect(a?.purpose).toBe("isolation fixture");
  });
});

describe("ID probing", () => {
  it("probing with A's UUIDs from B's scope yields not-found across models", async () => {
    const db = scopedDb(B.orgId);
    await expect(
      db.expenseReport.update({ where: { id: A.reportId }, data: { title: "x" } })
    ).rejects.toThrow();
    await expect(
      db.user.update({ where: { id: A.users.employee }, data: { name: "x" } })
    ).rejects.toThrow();
  });
});

describe("list scoping", () => {
  it("B's lists contain only B's records once A has data", async () => {
    const db = scopedDb(B.orgId);
    const [expenses, reports, users, categories] = await Promise.all([
      db.expense.findMany(),
      db.expenseReport.findMany(),
      db.user.findMany(),
      db.category.findMany(),
    ]);
    for (const rows of [expenses, reports, users, categories]) {
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.orgId).toBe(B.orgId);
    }
  });

  it("aggregates are scoped too", async () => {
    // A and B each have exactly one fixture expense of 12345
    const count = await scopedDb(B.orgId).expense.count();
    expect(count).toBe(1);
  });
});

describe("create stamping", () => {
  it("a create through B's scope lands in B even if A's orgId is smuggled in", async () => {
    const created = await scopedDb(B.orgId).expense.create({
      data: {
        orgId: A.orgId, // hostile input — must be overridden
        userId: B.users.employee,
        amount: 999,
        baseAmount: 999,
        fxRate: "1",
        currency: "INR",
        date: new Date("2026-08-02"),
        merchant: "Smuggle Mart",
        categoryId: B.categoryId,
      },
    });
    expect(created.orgId).toBe(B.orgId);
  });
});

describe("role bypass", () => {
  it("scope depends on org, not role — an org_admin scope for B sees no more of A than an employee scope", async () => {
    // scopedDb takes only orgId: role can never widen tenant reach. Assert
    // the tenant boundary holds for data belonging to A's most and least
    // privileged users alike.
    const db = scopedDb(B.orgId);
    expect(await db.user.findUnique({ where: { id: A.users.org_admin } })).toBeNull();
    expect(await db.user.findUnique({ where: { id: A.users.employee } })).toBeNull();
    const visible = await db.user.findMany();
    expect(visible.map((u: { orgId: string }) => u.orgId)).toEqual(
      visible.map(() => B.orgId)
    );
  });
});

// NOTE (skill step 5 — storage): receipt *rows* are covered above; signed-URL
// generation for receipt files arrives with upload in PLAN 1.3 and must add
// its own isolation case here proving B cannot obtain a URL for A's receipt.

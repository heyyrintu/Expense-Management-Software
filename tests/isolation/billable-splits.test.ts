// Isolation for 6.3: clients and splits are org-scoped.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aClientId: string;

beforeAll(async () => {
  A = await provisionOrg("bil-a");
  B = await provisionOrg("bil-b");
  const client = await owner.client.create({
    data: { orgId: A.orgId, name: "Acme Corp", code: "ACME" },
  });
  aClientId = client.id;
  await owner.expenseSplit.create({
    data: {
      orgId: A.orgId,
      expenseId: A.expenseId,
      categoryId: A.categoryId,
      amount: 12345,
    },
  });
});

afterAll(async () => {
  await owner.expenseSplit.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await owner.expense.updateMany({
    where: { orgId: { in: [A.orgId, B.orgId] } },
    data: { clientId: null },
  });
  await owner.client.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("clients", () => {
  it("B cannot read, rename, or delete A's client", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.client.findUnique({ where: { id: aClientId } })).toBeNull();
    const upd = await db.client.updateMany({
      where: { id: aClientId },
      data: { name: "hijack" },
    });
    expect(upd.count).toBe(0);
    const del = await db.client.deleteMany({ where: { id: aClientId } });
    expect(del.count).toBe(0);
  });

  it("the expense action's client validation rejects A's client from B's scope", async () => {
    expect(
      await scopedDb(B.orgId).client.findUnique({ where: { id: aClientId } })
    ).toBeNull();
  });

  it("same client code can exist independently per org", async () => {
    const b = await scopedDb(B.orgId).client.create({
      data: { orgId: B.orgId, name: "Acme Corp", code: "ACME" },
    });
    expect(b.orgId).toBe(B.orgId);
  });
});

describe("splits", () => {
  it("B cannot see A's splits nor attach a split to A's expense", async () => {
    const db = scopedDb(B.orgId);
    expect(
      await db.expenseSplit.findMany({ where: { expenseId: A.expenseId } })
    ).toHaveLength(0);
    await expect(
      db.expenseSplit.create({
        data: {
          orgId: B.orgId,
          expenseId: A.expenseId, // FK target invisible under B's RLS
          categoryId: B.categoryId,
          amount: 100,
        },
      })
    ).rejects.toThrow();
    expect(
      await owner.expenseSplit.count({ where: { expenseId: A.expenseId } })
    ).toBe(1);
  });

  it("A's own scope reads its splits (control)", async () => {
    expect(
      await scopedDb(A.orgId).expenseSplit.findMany({
        where: { expenseId: A.expenseId },
      })
    ).toHaveLength(1);
  });
});

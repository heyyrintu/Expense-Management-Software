// Isolation for 5.2: statement lines and matching stay inside the org.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aTxnId: string;

beforeAll(async () => {
  A = await provisionOrg("card-a");
  B = await provisionOrg("card-b");
  const txn = await owner.cardTransaction.create({
    data: {
      orgId: A.orgId,
      importedBatch: randomUUID(),
      date: new Date("2026-08-01T00:00:00.000Z"),
      amount: 12345,
      merchant: "card-a Cafe",
    },
  });
  aTxnId = txn.id;
});

afterAll(async () => {
  await owner.cardTransaction.deleteMany({
    where: { orgId: { in: [A.orgId, B.orgId] } },
  });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org card transactions", () => {
  it("B cannot see or match A's transaction", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.cardTransaction.findUnique({ where: { id: aTxnId } })).toBeNull();
    const upd = await db.cardTransaction.updateMany({
      where: { id: aTxnId, matchedExpenseId: null },
      data: { matchedExpenseId: B.expenseId },
    });
    expect(upd.count).toBe(0);
  });

  it("the match action's expense lookup rejects A's expense from B's scope", async () => {
    expect(
      await scopedDb(B.orgId).expense.findUnique({
        where: { id: A.expenseId },
        select: { id: true },
      })
    ).toBeNull();
  });

  it("A can match its own txn to its own expense; the 1:1 unique holds", async () => {
    const db = scopedDb(A.orgId);
    const upd = await db.cardTransaction.updateMany({
      where: { id: aTxnId, matchedExpenseId: null },
      data: { matchedExpenseId: A.expenseId },
    });
    expect(upd.count).toBe(1);
    // second txn cannot claim the same expense
    await expect(
      db.cardTransaction.create({
        data: {
          orgId: A.orgId,
          importedBatch: randomUUID(),
          date: new Date("2026-08-02T00:00:00.000Z"),
          amount: 12345,
          merchant: "dup",
          matchedExpenseId: A.expenseId,
        },
      })
    ).rejects.toThrow();
  });

  it("candidate query (unmatched expenses) never leaks across orgs", async () => {
    const rows = (await scopedDb(B.orgId).expense.findMany({
      where: { cardTransaction: null },
      select: { id: true },
    })) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).not.toContain(A.expenseId);
  });
});

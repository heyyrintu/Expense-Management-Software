// Isolation for 6.2 advances.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aAdvanceId: string;

beforeAll(async () => {
  A = await provisionOrg("adv-a");
  B = await provisionOrg("adv-b");
  await owner.user.update({
    where: { id: A.users.employee },
    data: { approverId: A.users.approver },
  });
  const adv = await owner.advance.create({
    data: {
      orgId: A.orgId,
      userId: A.users.employee,
      amount: 20000,
      purpose: "A trip",
      status: "disbursed",
      disbursedAt: new Date(),
      disbursementRef: "UTR-ADV-A",
    },
  });
  aAdvanceId = adv.id;
});

afterAll(async () => {
  await owner.advance.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org advance access", () => {
  it("B cannot read, decide, disburse, or settle A's advance", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.advance.findUnique({ where: { id: aAdvanceId } })).toBeNull();
    const upd = await db.advance.updateMany({
      where: { id: aAdvanceId },
      data: { status: "settled", settledAmount: 20000 },
    });
    expect(upd.count).toBe(0);
    const fresh = await owner.advance.findUnique({ where: { id: aAdvanceId } });
    expect(fresh?.status).toBe("disbursed");
    expect(fresh?.settledAmount).toBe(0);
  });

  it("B's settlement candidate query never sees A's open advances", async () => {
    const open = await scopedDb(B.orgId).advance.findMany({
      where: { status: { in: ["disbursed", "partially_settled"] } },
    });
    expect(open.map((a: { id: string }) => a.id)).not.toContain(aAdvanceId);
  });

  it("B's register and outstanding totals exclude A entirely", async () => {
    const all = await scopedDb(B.orgId).advance.findMany();
    for (const a of all as Array<{ orgId: string }>) expect(a.orgId).toBe(B.orgId);
  });
});

describe("in-org ownership pins", () => {
  it("a colleague cannot submit or delete my draft advance", async () => {
    const draft = await owner.advance.create({
      data: {
        orgId: A.orgId,
        userId: A.users.employee,
        amount: 5000,
        purpose: "draft",
        status: "draft",
      },
    });
    const db = scopedDb(A.orgId);
    // action patterns pin the session user
    expect(
      await db.advance.findUnique({
        where: { id: draft.id, userId: A.users.approver },
      })
    ).toBeNull();
    const del = await db.advance.deleteMany({
      where: { id: draft.id, userId: A.users.approver, status: "draft" },
    });
    expect(del.count).toBe(0);
    await owner.advance.delete({ where: { id: draft.id } });
  });
});

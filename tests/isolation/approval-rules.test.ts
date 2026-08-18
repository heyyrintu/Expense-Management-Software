// Isolation for 5.4 approval rules.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aRuleId: string;

beforeAll(async () => {
  A = await provisionOrg("rule-a");
  B = await provisionOrg("rule-b");
  const r = await owner.approvalRule.create({
    data: {
      orgId: A.orgId,
      name: "A big tickets",
      approverId: A.users.approver,
      aboveAmount: 10000,
    },
  });
  aRuleId = r.id;
});

afterAll(async () => {
  await owner.approvalRule.deleteMany({
    where: { orgId: { in: [A.orgId, B.orgId] } },
  });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org approval rules", () => {
  it("B cannot see or delete A's rule; B's routing never loads it", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.approvalRule.findUnique({ where: { id: aRuleId } })).toBeNull();
    expect(await db.approvalRule.findMany()).toHaveLength(0);
    const del = await db.approvalRule.deleteMany({ where: { id: aRuleId } });
    expect(del.count).toBe(0);
    expect(await owner.approvalRule.findUnique({ where: { id: aRuleId } })).not.toBeNull();
  });

  it("the create action's approver validation rejects A's user from B's scope", async () => {
    expect(
      await scopedDb(B.orgId).user.findUnique({
        where: { id: A.users.approver },
        select: { status: true, role: true },
      })
    ).toBeNull();
  });
});

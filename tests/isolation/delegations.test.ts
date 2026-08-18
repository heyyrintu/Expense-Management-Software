// Isolation + authz for 6.5: delegations are org-scoped; acting-as can never
// cross orgs or confer approval rights.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canDecideAtLevel } from "@/lib/domain/approvals";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aDelegationId: string;

beforeAll(async () => {
  A = await provisionOrg("del-a");
  B = await provisionOrg("del-b");
  const d = await owner.delegation.create({
    data: {
      orgId: A.orgId,
      delegateId: A.users.employee,
      principalId: A.users.approver,
    },
  });
  aDelegationId = d.id;
});

afterAll(async () => {
  await owner.recurringTemplate.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await owner.delegation.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("delegation org-scoping", () => {
  it("B cannot see or revoke A's delegation", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.delegation.findUnique({ where: { id: aDelegationId } })).toBeNull();
    const upd = await db.delegation.updateMany({
      where: { id: aDelegationId },
      data: { active: false },
    });
    expect(upd.count).toBe(0);
  });

  it("a cross-org acting cookie can never validate: the resolveActing lookup is scoped", async () => {
    // resolveActing's exact query, run from B's scope with A's principal id
    const hit = await scopedDb(B.orgId).delegation.findFirst({
      where: {
        delegateId: B.users.employee,
        principalId: A.users.approver, // cross-org principal
        active: true,
      },
    });
    expect(hit).toBeNull(); // falls back to self — no cross-org acting
  });

  it("a delegation pointing at another org's user cannot even be created in-scope (validation lookup fails)", async () => {
    expect(
      await scopedDb(B.orgId).user.findUnique({
        where: { id: A.users.approver },
        select: { status: true },
      })
    ).toBeNull();
  });
});

describe("acting never confers approval rights", () => {
  it("eligibility uses the REAL identity — the delegate is not the responsible approver", () => {
    // A.employee acts for A.approver, who is responsible for level 1.
    // decideOne passes ctx.userId (the delegate's REAL id) — never eligible.
    expect(
      canDecideAtLevel({
        actorId: A.users.employee, // real identity of the acting delegate
        actorRole: "employee",
        ownerId: "someone-else",
        responsibleLevel1Id: A.users.approver, // the principal is responsible
        decidedLevel1Id: null,
        level2: null,
        level: 1,
      })
    ).toBe(false);
  });
});

describe("recurring templates org-scoping", () => {
  it("B cannot see or run against A's templates", async () => {
    const tpl = await owner.recurringTemplate.create({
      data: {
        orgId: A.orgId,
        userId: A.users.employee,
        cadence: "monthly",
        day: 1,
        amount: 99900,
        categoryId: A.categoryId,
        merchant: "A Broadband",
      },
    });
    const db = scopedDb(B.orgId);
    expect(await db.recurringTemplate.findUnique({ where: { id: tpl.id } })).toBeNull();
    expect(await db.recurringTemplate.findMany({ where: { active: true } })).toHaveLength(0);
  });
});

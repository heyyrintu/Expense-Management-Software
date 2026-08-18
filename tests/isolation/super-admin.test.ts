// Isolation for 5.5: suspension is per-org, super-admin identities live
// outside tenant tables, and tenant scopes are unaffected by platform rows.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("sup-a");
  B = await provisionOrg("sup-b");
});

afterAll(async () => {
  await owner.auditLog.deleteMany({
    where: { orgId: { in: [A.orgId, B.orgId] } },
  });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("suspension scope", () => {
  it("suspending A leaves B active, and the action is logged in A's audit trail", async () => {
    // the action's exact write pattern (raw client, status-guarded)
    const res = await owner.organization.updateMany({
      where: { id: A.orgId, status: "active" },
      data: { status: "suspended" },
    });
    expect(res.count).toBe(1);
    await owner.auditLog.create({
      data: {
        orgId: A.orgId,
        entity: "Organization",
        entityId: A.orgId,
        actorId: null,
        action: "org.suspended",
        meta: { superAdmin: "superadmin@platform.test" },
      },
    });

    const a = await owner.organization.findUnique({ where: { id: A.orgId } });
    const b = await owner.organization.findUnique({ where: { id: B.orgId } });
    expect(a?.status).toBe("suspended");
    expect(b?.status).toBe("active");

    // the audit row is visible ONLY inside A's tenant scope
    expect(
      await scopedDb(A.orgId).auditLog.count({ where: { action: "org.suspended" } })
    ).toBe(1);
    expect(
      await scopedDb(B.orgId).auditLog.count({ where: { action: "org.suspended" } })
    ).toBe(0);

    // suspended-org check used by getSessionCtx: status is readable in-scope
    const org = await scopedDb(A.orgId).organization.findUnique({
      where: { id: A.orgId },
      select: { status: true },
    });
    expect(org?.status).toBe("suspended");

    // restore
    await owner.organization.update({
      where: { id: A.orgId },
      data: { status: "active" },
    });
  });

  it("double-suspend is a no-op (status-guarded write)", async () => {
    await owner.organization.update({
      where: { id: A.orgId },
      data: { status: "suspended" },
    });
    const res = await owner.organization.updateMany({
      where: { id: A.orgId, status: "active" },
      data: { status: "suspended" },
    });
    expect(res.count).toBe(0);
    await owner.organization.update({
      where: { id: A.orgId },
      data: { status: "active" },
    });
  });
});

describe("super-admin identity separation", () => {
  it("super admins are not tenant users — no org scope can see them", async () => {
    const admin = await owner.superAdmin.upsert({
      where: { email: "iso-super@platform.test" },
      update: {},
      create: { email: "iso-super@platform.test", passwordHash: "x" },
    });
    // tenant user lookups by that id/email find nothing
    expect(
      await scopedDb(A.orgId).user.findUnique({ where: { id: admin.id } })
    ).toBeNull();
    const byEmail = await scopedDb(A.orgId).user.findMany({
      where: { email: "iso-super@platform.test" },
    });
    expect(byEmail).toHaveLength(0);
    await owner.superAdmin.delete({ where: { id: admin.id } });
  });
});

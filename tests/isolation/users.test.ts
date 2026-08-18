// Isolation for 2.0 user management: org B's admin must not reach org A's
// users through any of the action data paths; invite tokens are org-bound.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createInviteToken,
  verifyInviteToken,
} from "@/lib/auth/invite-token";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

const SECRET = "isolation-test-secret";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("usr-a");
  B = await provisionOrg("usr-b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org user management", () => {
  it("B's admin cannot list or read A's users", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.user.findUnique({ where: { id: A.users.employee } })).toBeNull();
    const all = await db.user.findMany();
    for (const u of all as Array<{ orgId: string }>) expect(u.orgId).toBe(B.orgId);
  });

  it("B's admin cannot edit or deactivate A's users", async () => {
    const db = scopedDb(B.orgId);
    await expect(
      db.user.update({ where: { id: A.users.employee }, data: { role: "org_admin" } })
    ).rejects.toThrow();
    const deact = await db.user.updateMany({
      where: { id: A.users.employee, status: "active" },
      data: { status: "deactivated" },
    });
    expect(deact.count).toBe(0);
    const fresh = await owner.user.findUnique({ where: { id: A.users.employee } });
    expect(fresh?.status).toBe("active");
    expect(fresh?.role).toBe("employee");
  });

  it("B's admin cannot revoke (delete) an invited user in A", async () => {
    const invited = await owner.user.create({
      data: {
        orgId: A.orgId,
        name: "Pending A",
        email: `pending@${A.slug}.test`,
        role: "employee",
        status: "invited",
      },
    });
    const res = await scopedDb(B.orgId).user.deleteMany({
      where: { id: invited.id, status: "invited" },
    });
    expect(res.count).toBe(0);
    expect(await owner.user.findUnique({ where: { id: invited.id } })).not.toBeNull();
    await owner.user.delete({ where: { id: invited.id } });
  });
});

describe("invite tokens are org-bound", () => {
  it("a token minted for org A resolves to org A claims and fails in B's scope", async () => {
    const token = createInviteToken(A.users.employee, A.orgId, { secret: SECRET });
    const claims = verifyInviteToken(token, { secret: SECRET });
    expect(claims).toEqual({ userId: A.users.employee, orgId: A.orgId });
    // accept flow uses scopedDb(claims.orgId) — a forged claim pointing at B
    // cannot resolve A's user
    expect(
      await scopedDb(B.orgId).user.findUnique({ where: { id: claims!.userId } })
    ).toBeNull();
    // and the legitimate scope can
    expect(
      await scopedDb(A.orgId).user.findUnique({ where: { id: claims!.userId } })
    ).not.toBeNull();
  });
});

describe("cross-org departments", () => {
  it("B cannot rename or delete A's department", async () => {
    const dept = await owner.department.create({
      data: { orgId: A.orgId, name: "Iso Dept A" },
    });
    const db = scopedDb(B.orgId);
    await expect(
      db.department.update({ where: { id: dept.id }, data: { name: "hijack" } })
    ).rejects.toThrow();
    const del = await db.department.deleteMany({ where: { id: dept.id } });
    expect(del.count).toBe(0);
    expect(await owner.department.findUnique({ where: { id: dept.id } })).not.toBeNull();
    await owner.department.delete({ where: { id: dept.id } });
  });
});

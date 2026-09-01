// Isolation cases for the 1.1 data paths (category CRUD, org settings)
// — tenant-isolation-check skill, applied to the new feature.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("set-a");
  B = await provisionOrg("set-b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("category CRUD isolation", () => {
  it("B cannot update A's category (and it stays unchanged)", async () => {
    await expect(
      scopedDb(B.orgId).category.update({
        where: { id: A.categoryId },
        data: { name: "hijacked" },
      })
    ).rejects.toThrow();
    const fresh = await owner.category.findUnique({ where: { id: A.categoryId } });
    expect(fresh?.name).toBe("Travel");
  });

  it("B cannot delete A's category", async () => {
    await expect(
      scopedDb(B.orgId).category.delete({ where: { id: A.categoryId } })
    ).rejects.toThrow();
    expect(await owner.category.findUnique({ where: { id: A.categoryId } })).not.toBeNull();
  });

  it("categories created in B never appear in A's list", async () => {
    await scopedDb(B.orgId).category.create({ data: { orgId: B.orgId, name: "B-only" } });
    const aNames = (await scopedDb(A.orgId).category.findMany()).map(
      (c: { name: string }) => c.name
    );
    expect(aNames).not.toContain("B-only");
  });

  it("same-name categories can coexist across orgs (unique is per-org)", async () => {
    await scopedDb(A.orgId).category.create({ data: { orgId: A.orgId, name: "Shared Name" } });
    await scopedDb(B.orgId).category.create({ data: { orgId: B.orgId, name: "Shared Name" } });
    expect(await owner.category.count({ where: { name: "Shared Name" } })).toBe(2);
  });
});

describe("org settings isolation", () => {
  it("B's scope cannot update A's organization settings", async () => {
    // This previously asserted the write LANDED ON B — scope-args replaced
    // where.id with the session org, so an update aimed at A silently
    // mutated B's own settings and reported success. A caller that passed
    // the wrong id would corrupt its own row and never find out. The scope
    // is ANDed now, so the update matches no record and Prisma raises.
    await expect(
      scopedDb(B.orgId).organization.update({
        where: { id: A.orgId },
        data: { currency: "USD" },
      })
    ).rejects.toThrow();

    const a = await owner.organization.findUnique({ where: { id: A.orgId } });
    const b = await owner.organization.findUnique({ where: { id: B.orgId } });
    expect(a?.currency).toBe("INR"); // A untouched
    expect(b?.currency).toBe("INR"); // and B not collaterally rewritten
  });

  it("B's scope can still update its OWN organization settings", async () => {
    await scopedDb(B.orgId).organization.update({
      where: { id: B.orgId },
      data: { currency: "USD" },
    });
    const b = await owner.organization.findUnique({ where: { id: B.orgId } });
    expect(b?.currency).toBe("USD");
  });

  it("audit rows are stamped with the writer's org", async () => {
    const db = scopedDb(B.orgId);
    await db.auditLog.create({
      data: {
        orgId: B.orgId,
        entity: "Category",
        entityId: B.categoryId,
        actorId: B.users.finance_admin,
        action: "category.updated",
        meta: {},
      },
    });
    const rows = await db.auditLog.findMany({ where: { action: "category.updated" } });
    for (const r of rows) expect(r.orgId).toBe(B.orgId);
    expect(
      await scopedDb(A.orgId).auditLog.count({
        where: { entityId: B.categoryId },
      })
    ).toBe(0);
  });
});

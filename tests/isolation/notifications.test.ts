// Isolation for 2.3 notifications: org-scoped AND recipient-pinned.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("ntf-a");
  B = await provisionOrg("ntf-b");
  await owner.notification.create({
    data: {
      orgId: A.orgId,
      userId: A.users.employee,
      type: "report.submitted",
      title: "A's notification",
      body: "for A employee",
    },
  });
});

afterAll(async () => {
  await owner.notification.deleteMany({
    where: { orgId: { in: [A.orgId, B.orgId] } },
  });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org", () => {
  it("B sees none of A's notifications and cannot mark them read", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.notification.findMany()).toHaveLength(0);
    const upd = await db.notification.updateMany({
      where: { title: "A's notification" },
      data: { readAt: new Date() },
    });
    expect(upd.count).toBe(0);
  });
});

describe("cross-user within one org", () => {
  it("the recipient pin keeps colleagues out of each other's inboxes", async () => {
    const db = scopedDb(A.orgId);
    // approver's inbox query never returns the employee's notification
    const inbox = await db.notification.findMany({
      where: { userId: A.users.approver },
    });
    expect(inbox).toHaveLength(0);
    // and the mark-read pattern from the action can't touch it either
    const upd = await db.notification.updateMany({
      where: { title: "A's notification", userId: A.users.approver, readAt: null },
      data: { readAt: new Date() },
    });
    expect(upd.count).toBe(0);
    const fresh = await owner.notification.findFirst({
      where: { title: "A's notification" },
    });
    expect(fresh?.readAt).toBeNull();
  });
});

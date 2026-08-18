// Isolation for 5.3 report comments.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("cmt-a");
  B = await provisionOrg("cmt-b");
  await owner.reportComment.create({
    data: {
      orgId: A.orgId,
      reportId: A.reportId,
      authorId: A.users.employee,
      body: "A's private discussion",
    },
  });
});

afterAll(async () => {
  await owner.reportComment.deleteMany({
    where: { orgId: { in: [A.orgId, B.orgId] } },
  });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org comment access", () => {
  it("B cannot read A's thread", async () => {
    const rows = await scopedDb(B.orgId).reportComment.findMany({
      where: { reportId: A.reportId },
    });
    expect(rows).toHaveLength(0);
  });

  it("B cannot post into A's thread — the report is unreachable and RLS blocks the insert", async () => {
    // action path: report lookup fails closed
    expect(
      await scopedDb(B.orgId).expenseReport.findUnique({ where: { id: A.reportId } })
    ).toBeNull();
    // even a forced insert is rejected (FK target invisible under B's RLS)
    await expect(
      scopedDb(B.orgId).reportComment.create({
        data: {
          orgId: B.orgId,
          reportId: A.reportId,
          authorId: B.users.approver,
          body: "intrusion",
        },
      })
    ).rejects.toThrow();
    expect(
      await owner.reportComment.count({ where: { reportId: A.reportId } })
    ).toBe(1);
  });

  it("A's own scope reads its thread (control)", async () => {
    const rows = await scopedDb(A.orgId).reportComment.findMany({
      where: { reportId: A.reportId },
    });
    expect(rows).toHaveLength(1);
  });
});

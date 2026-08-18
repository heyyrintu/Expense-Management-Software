// Isolation for 2.1 report workflow data paths.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("rep-a");
  B = await provisionOrg("rep-b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org report access", () => {
  it("B cannot read or mutate A's report through the owner-pinned pattern", async () => {
    const db = scopedDb(B.orgId);
    expect(
      await db.expenseReport.findUnique({
        where: { id: A.reportId, userId: B.users.employee },
      })
    ).toBeNull();
    const upd = await db.expenseReport.updateMany({
      where: { id: A.reportId },
      data: { title: "hijack" },
    });
    expect(upd.count).toBe(0);
  });

  it("B cannot attach one of A's expenses to a B report", async () => {
    const db = scopedDb(B.orgId);
    const res = await db.expense.updateMany({
      where: {
        id: A.expenseId,
        userId: B.users.employee,
        status: "draft",
        reportId: null,
      },
      data: { reportId: B.reportId },
    });
    expect(res.count).toBe(0);
    const fresh = await owner.expense.findUnique({ where: { id: A.expenseId } });
    expect(fresh?.reportId).toBe(A.reportId); // untouched
  });
});

describe("cross-user report access within one org", () => {
  it("a colleague cannot open or submit my report (owner pin)", async () => {
    const db = scopedDb(A.orgId);
    expect(
      await db.expenseReport.findUnique({
        where: { id: A.reportId, userId: A.users.approver },
      })
    ).toBeNull();
  });

  it("a colleague cannot pull my draft expense onto their report", async () => {
    const db = scopedDb(A.orgId);
    // detach fixture expense first so it would otherwise be attachable
    await owner.expense.update({
      where: { id: A.expenseId },
      data: { reportId: null },
    });
    const theirReport = await db.expenseReport.create({
      data: { orgId: A.orgId, userId: A.users.approver, title: "their report" },
    });
    const res = await db.expense.updateMany({
      where: {
        id: A.expenseId,
        userId: A.users.approver, // action pins the SESSION user — not the owner
        status: "draft",
        reportId: null,
      },
      data: { reportId: theirReport.id },
    });
    expect(res.count).toBe(0);
    // restore fixture
    await owner.expense.update({
      where: { id: A.expenseId },
      data: { reportId: A.reportId },
    });
  });
});

describe("audit trail on transitions", () => {
  it("report status changes recorded via scopedDb stay org-stamped", async () => {
    const db = scopedDb(B.orgId);
    await db.auditLog.create({
      data: {
        orgId: B.orgId,
        entity: "ExpenseReport",
        entityId: B.reportId,
        actorId: B.users.employee,
        action: "report.submitted",
        meta: { total: 12345 },
      },
    });
    expect(
      await scopedDb(A.orgId).auditLog.count({
        where: { entityId: B.reportId, action: "report.submitted" },
      })
    ).toBe(0);
  });
});

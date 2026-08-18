// Isolation for 4.1: reimbursement is confined to the finance admin's org.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("rmb-a");
  B = await provisionOrg("rmb-b");
  await owner.expenseReport.update({
    where: { id: A.reportId },
    data: { status: "approved", submittedAt: new Date(), total: 12345 },
  });
});

afterAll(async () => {
  await owner.reimbursement.deleteMany({
    where: { orgId: { in: [A.orgId, B.orgId] } },
  });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org reimbursement", () => {
  it("B's finance queue never lists A's approved reports", async () => {
    const queue = await scopedDb(B.orgId).expenseReport.findMany({
      where: { status: "approved" },
    });
    expect(queue.map((r: { id: string }) => r.id)).not.toContain(A.reportId);
  });

  it("B cannot load A's report to reimburse it, nor insert a reimbursement row pointing at it", async () => {
    expect(
      await scopedDb(B.orgId).expenseReport.findUnique({ where: { id: A.reportId } })
    ).toBeNull();
    await expect(
      scopedDb(B.orgId).reimbursement.create({
        data: {
          orgId: B.orgId,
          reportId: A.reportId, // FK target invisible under B's RLS
          amount: 12345,
          paidAt: new Date(),
          reference: "hijack-ref",
          paidById: B.users.finance_admin,
        },
      })
    ).rejects.toThrow();
    expect(await owner.reimbursement.count({ where: { reportId: A.reportId } })).toBe(0);
    const fresh = await owner.expenseReport.findUnique({ where: { id: A.reportId } });
    expect(fresh?.status).toBe("approved"); // untouched
  });

  it("A's own scope can reimburse (control) and double-payment is blocked by the unique constraint", async () => {
    const db = scopedDb(A.orgId);
    await db.reimbursement.create({
      data: {
        orgId: A.orgId,
        reportId: A.reportId,
        amount: 12345,
        paidAt: new Date(),
        reference: "BATCH-1",
        paidById: A.users.finance_admin,
      },
    });
    await expect(
      db.reimbursement.create({
        data: {
          orgId: A.orgId,
          reportId: A.reportId,
          amount: 12345,
          paidAt: new Date(),
          reference: "BATCH-2",
          paidById: A.users.finance_admin,
        },
      })
    ).rejects.toThrow(); // @unique reportId
  });
});

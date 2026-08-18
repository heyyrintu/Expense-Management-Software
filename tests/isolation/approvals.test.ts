// Isolation for 2.2 approvals: decisions are confined to the actor's org,
// and the queue never surfaces another org's reports.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approvalQueueFor } from "@/lib/domain/approval-queue";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("app-a");
  B = await provisionOrg("app-b");
  // submit A's fixture report (owner: A employee, approver assigned below)
  await owner.user.update({
    where: { id: A.users.employee },
    data: { approverId: A.users.approver },
  });
  await owner.expenseReport.update({
    where: { id: A.reportId },
    data: { status: "submitted", submittedAt: new Date(), total: 12345 },
  });
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("queue scoping", () => {
  it("A's approver sees the report; B's approver sees nothing of A", async () => {
    const aQueue = await approvalQueueFor(scopedDb(A.orgId), {
      userId: A.users.approver,
      orgId: A.orgId,
      role: "approver",
    });
    expect(aQueue.map((q) => q.id)).toContain(A.reportId);

    const bQueue = await approvalQueueFor(scopedDb(B.orgId), {
      userId: B.users.approver,
      orgId: B.orgId,
      role: "approver",
    });
    expect(bQueue.map((q) => q.id)).not.toContain(A.reportId);
  });

  it("even B's org_admin sees none of A's submitted reports", async () => {
    const bQueue = await approvalQueueFor(scopedDb(B.orgId), {
      userId: B.users.org_admin,
      orgId: B.orgId,
      role: "org_admin",
    });
    expect(bQueue.map((q) => q.id)).not.toContain(A.reportId);
  });
});

describe("decision data path", () => {
  it("B cannot read A's submitted report to decide on it", async () => {
    expect(
      await scopedDb(B.orgId).expenseReport.findUnique({ where: { id: A.reportId } })
    ).toBeNull();
  });

  it("approval rows for A's report cannot be created from B's scope (RLS WITH CHECK)", async () => {
    await expect(
      scopedDb(B.orgId).approval.create({
        data: {
          orgId: B.orgId, // scopedDb stamps B — but reportId points at A
          reportId: A.reportId,
          approverId: B.users.approver,
          level: 1,
          action: "approved",
        },
      })
    ).rejects.toThrow(); // FK to expense_reports is invisible under B's RLS
    expect(
      await owner.approval.count({ where: { reportId: A.reportId } })
    ).toBe(0);
  });
});

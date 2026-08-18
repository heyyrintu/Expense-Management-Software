// Isolation for 6.1: payment batches, bank details, and proof keys stay
// inside the org.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aBatchId: string;

beforeAll(async () => {
  A = await provisionOrg("pay-a");
  B = await provisionOrg("pay-b");
  const batch = await owner.paymentBatch.create({
    data: {
      orgId: A.orgId,
      createdById: A.users.finance_admin,
      method: "bank_transfer",
      paidAt: new Date(),
      notes: "A run",
    },
  });
  aBatchId = batch.id;
  await owner.user.update({
    where: { id: A.users.employee },
    data: {
      bankAccountName: "A Employee",
      bankAccountNumber: "12345678901234",
      bankIfsc: "HDFC0001234",
    },
  });
  await owner.expenseReport.update({
    where: { id: A.reportId },
    data: { status: "approved", total: 12345 },
  });
  await owner.reimbursement.create({
    data: {
      orgId: A.orgId,
      reportId: A.reportId,
      amount: 12345,
      amountPaid: 5000,
      method: "upi",
      paidAt: new Date(),
      reference: "UTR-A-1",
      batchId: aBatchId,
      proofKey: `${A.orgId}/payment-proofs/${aBatchId}/proof.pdf`,
      paidById: A.users.finance_admin,
    },
  });
});

afterAll(async () => {
  await owner.reimbursement.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await owner.paymentBatch.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("payment batches", () => {
  it("B cannot see A's batches or their payments", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.paymentBatch.findUnique({ where: { id: aBatchId } })).toBeNull();
    expect(await db.paymentBatch.findMany()).toHaveLength(0);
    expect(
      await db.reimbursement.findMany({ where: { batchId: aBatchId } })
    ).toHaveLength(0);
  });

  it("B cannot attach a payment to A's batch (RLS hides the FK target)", async () => {
    await expect(
      scopedDb(B.orgId).reimbursement.create({
        data: {
          orgId: B.orgId,
          reportId: B.reportId,
          amount: 12345,
          amountPaid: 12345,
          paidAt: new Date(),
          reference: "x",
          batchId: aBatchId,
          paidById: B.users.finance_admin,
        },
      })
    ).rejects.toThrow();
  });
});

describe("bank details", () => {
  it("B's scope cannot read A's employee bank fields", async () => {
    expect(
      await scopedDb(B.orgId).user.findUnique({
        where: { id: A.users.employee },
        select: { bankAccountNumber: true },
      })
    ).toBeNull();
  });

  it("A's own scope reads them (control) — masking happens at display", async () => {
    const u = await scopedDb(A.orgId).user.findUnique({
      where: { id: A.users.employee },
      select: { bankAccountNumber: true },
    });
    expect(u?.bankAccountNumber).toBe("12345678901234");
  });
});

describe("proof keys", () => {
  it("B cannot resolve A's payment row, so no proof URL can be issued; keys live under A's prefix", async () => {
    const bView = await scopedDb(B.orgId).reimbursement.findMany({
      where: { proofKey: { not: null } },
    });
    expect(bView).toHaveLength(0);
    const aView = (await scopedDb(A.orgId).reimbursement.findMany({
      where: { proofKey: { not: null } },
    })) as Array<{ proofKey: string | null }>;
    expect(aView).toHaveLength(1);
    expect(aView[0].proofKey?.startsWith(`${A.orgId}/payment-proofs/`)).toBe(true);
  });
});

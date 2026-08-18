// Isolation for 7.2: statement imports/lines are org-scoped and cross-org
// matching is structurally impossible.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aImportId: string;
let aLineId: string;
let aPaymentId: string;

beforeAll(async () => {
  A = await provisionOrg("bank-a");
  B = await provisionOrg("bank-b");
  await owner.expenseReport.update({
    where: { id: A.reportId },
    data: { status: "reimbursed", total: 12345 },
  });
  const payment = await owner.reimbursement.create({
    data: {
      orgId: A.orgId,
      reportId: A.reportId,
      amount: 12345,
      amountPaid: 12345,
      method: "bank_transfer",
      paidAt: new Date("2026-08-05"),
      reference: "UTRBANKA0001",
      paidById: A.users.finance_admin,
    },
  });
  aPaymentId = payment.id;
  const imp = await owner.bankStatementImport.create({
    data: {
      orgId: A.orgId,
      filename: "aug.csv",
      columnMapping: { dateCol: 0, amountCol: 1, referenceCol: 2 },
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-08-31"),
      importedById: A.users.finance_admin,
    },
  });
  aImportId = imp.id;
  const line = await owner.bankStatementLine.create({
    data: {
      orgId: A.orgId,
      importId: imp.id,
      date: new Date("2026-08-05"),
      amount: 12345,
      reference: "NEFT UTRBANKA0001",
    },
  });
  aLineId = line.id;
});

afterAll(async () => {
  await owner.bankStatementLine.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await owner.bankStatementImport.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await owner.reimbursement.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("cross-org bank data", () => {
  it("B cannot see A's imports or lines", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.bankStatementImport.findUnique({ where: { id: aImportId } })).toBeNull();
    expect(await db.bankStatementLine.findMany({ where: { importId: aImportId } })).toHaveLength(0);
  });

  it("B cannot match its line to A's payment (RLS hides the FK target)", async () => {
    const dbB = scopedDb(B.orgId);
    const bImport = await dbB.bankStatementImport.create({
      data: {
        orgId: B.orgId,
        filename: "b.csv",
        columnMapping: { dateCol: 0, amountCol: 1, referenceCol: 2 },
        periodStart: new Date("2026-08-01"),
        periodEnd: new Date("2026-08-31"),
        importedById: B.users.finance_admin,
      },
    });
    await expect(
      dbB.bankStatementLine.create({
        data: {
          orgId: B.orgId,
          importId: bImport.id,
          date: new Date("2026-08-05"),
          amount: 12345,
          reference: "steal",
          matchedReimbursementId: aPaymentId, // A's payment — invisible under B's RLS
        },
      })
    ).rejects.toThrow();
  });

  it("A matches its own line; the unique constraint then blocks a second claim", async () => {
    const db = scopedDb(A.orgId);
    const upd = await db.bankStatementLine.updateMany({
      where: { id: aLineId, matchedReimbursementId: null },
      data: { matchedReimbursementId: aPaymentId, matchType: "auto" },
    });
    expect(upd.count).toBe(1);
    await expect(
      db.bankStatementLine.create({
        data: {
          orgId: A.orgId,
          importId: aImportId,
          date: new Date("2026-08-06"),
          amount: 12345,
          reference: "dup",
          matchedReimbursementId: aPaymentId,
        },
      })
    ).rejects.toThrow(); // unique matched_reimbursement_id
  });

  it("lock state respected: the actions' unlocked check sees the lock", async () => {
    await owner.bankStatementImport.update({
      where: { id: aImportId },
      data: { lockedAt: new Date() },
    });
    const line = await scopedDb(A.orgId).bankStatementLine.findUnique({
      where: { id: aLineId },
      include: { import: { select: { lockedAt: true } } },
    });
    expect(line?.import.lockedAt).not.toBeNull();
  });
});

// Isolation + live reconciliation for 7.1: the derived ledger stays inside
// the org, and its outstanding equals approved − paid from the SOURCE tables
// — with partial payments and advance offsets in play.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchLedgerEvents } from "@/lib/analytics/ledger";
import { buildLedger } from "@/lib/domain/ledger";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("led-a");
  B = await provisionOrg("led-b");

  // A's employee: approved report (12345) with a PARTIAL payment (5000),
  // a disbursed advance (20000) partially settled (5000).
  await owner.expenseReport.update({
    where: { id: A.reportId },
    data: { status: "partially_reimbursed", submittedAt: new Date("2026-08-01"), total: 12345 },
  });
  await owner.approval.create({
    data: {
      orgId: A.orgId,
      reportId: A.reportId,
      approverId: A.users.approver,
      level: 1,
      action: "approved",
      actedAt: new Date("2026-08-02"),
    },
  });
  await owner.reimbursement.create({
    data: {
      orgId: A.orgId,
      reportId: A.reportId,
      amount: 12345,
      amountPaid: 5000,
      method: "bank_transfer",
      paidAt: new Date("2026-08-05"),
      reference: "UTR-LED-1",
      paidById: A.users.finance_admin,
    },
  });
  const advance = await owner.advance.create({
    data: {
      orgId: A.orgId,
      userId: A.users.employee,
      amount: 20000,
      purpose: "Ledger trip",
      status: "partially_settled",
      disbursedAt: new Date("2026-08-03"),
      disbursementRef: "ADV-LED-1",
      settledAmount: 5000,
    },
  });
  await owner.auditLog.create({
    data: {
      orgId: A.orgId,
      entity: "Advance",
      entityId: advance.id,
      actorId: A.users.finance_admin,
      action: "advance.settled",
      meta: { amount: 5000, viaReportId: A.reportId },
      timestamp: new Date("2026-08-05"),
    },
  });
});

afterAll(async () => {
  await owner.reimbursement.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await owner.advance.deleteMany({ where: { orgId: { in: [A.orgId, B.orgId] } } });
  await teardownOrgs([A.orgId, B.orgId]);
  await owner.$disconnect();
});

describe("reconciliation invariant (live)", () => {
  it("ledger outstanding === approved − paid from the source tables", async () => {
    const db = scopedDb(A.orgId);
    const { events, requested } = await fetchLedgerEvents(db, A.users.employee);
    const { lines, totals } = buildLedger(events, requested);

    // source-table truth
    const approvedAgg = await db.expenseReport.aggregate({
      where: {
        userId: A.users.employee,
        status: { in: ["approved", "partially_reimbursed", "reimbursed"] },
      },
      _sum: { total: true },
    });
    const paidAgg = await db.reimbursement.aggregate({
      where: { report: { userId: A.users.employee } },
      _sum: { amountPaid: true },
    });
    const sourceOutstanding =
      (approvedAgg._sum.total ?? 0) - (paidAgg._sum.amountPaid ?? 0);

    expect(totals.outstanding).toBe(sourceOutstanding);
    expect(totals.outstanding).toBe(7345); // 12345 − 5000
    // net position: 12345 − 5000 − 20000 + 5000 = −7655 (owes org)
    expect(totals.netBalance).toBe(-7655);
    expect(lines).toHaveLength(4);
    // deterministic order: approval(2nd), advance(3rd), then two on the 5th by id
    expect(lines[0].type).toBe("report_approved");
    expect(lines[1].type).toBe("advance_disbursed");
  });
});

describe("cross-org ledger access", () => {
  it("B's scope derives an EMPTY ledger for A's employee", async () => {
    const { events, requested } = await fetchLedgerEvents(
      scopedDb(B.orgId),
      A.users.employee
    );
    expect(events).toHaveLength(0);
    expect(requested).toBe(0);
  });

  it("the export route's user lookup fails closed across orgs", async () => {
    expect(
      await scopedDb(B.orgId).user.findUnique({
        where: { id: A.users.employee },
        select: { id: true, name: true },
      })
    ).toBeNull();
  });
});

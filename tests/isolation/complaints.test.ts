// Isolation for 7.3: complaints and their threads are org-scoped, the
// exactly-one-target CHECK holds at the database, and cross-org linking is
// structurally impossible (RLS hides the FK target).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;
let aComplaintId: string;
let aMessageId: string;
let aPaymentId: string;

beforeAll(async () => {
  A = await provisionOrg("comp-a");
  B = await provisionOrg("comp-b");

  const payment = await owner.reimbursement.create({
    data: {
      orgId: A.orgId,
      reportId: A.reportId,
      amount: 12345,
      amountPaid: 12345,
      method: "bank_transfer",
      paidAt: new Date("2026-08-05"),
      reference: "UTRCOMPA1",
      paidById: A.users.finance_admin,
    },
  });
  aPaymentId = payment.id;

  const complaint = await owner.complaint.create({
    data: {
      orgId: A.orgId,
      raisedById: A.users.employee,
      reportId: A.reportId,
      type: "wrong_amount",
      description: "Approved 500 but paid 300.",
      assignedToId: A.users.finance_admin,
    },
  });
  aComplaintId = complaint.id;

  const message = await owner.complaintMessage.create({
    data: {
      orgId: A.orgId,
      complaintId: complaint.id,
      authorId: A.users.employee,
      body: "Any update on this?",
    },
  });
  aMessageId = message.id;
});

afterAll(async () => {
  const orgs = [A.orgId, B.orgId];
  await owner.complaintMessage.deleteMany({ where: { orgId: { in: orgs } } });
  await owner.complaint.deleteMany({ where: { orgId: { in: orgs } } });
  await owner.reimbursement.deleteMany({ where: { orgId: { in: orgs } } });
  await teardownOrgs(orgs);
  await owner.$disconnect();
});

describe("cross-org complaints", () => {
  it("B cannot read A's complaint by id or in a list", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.complaint.findUnique({ where: { id: aComplaintId } })).toBeNull();
    expect(await db.complaint.findMany({})).toHaveLength(0);
  });

  it("B cannot read A's thread", async () => {
    const db = scopedDb(B.orgId);
    expect(await db.complaintMessage.findUnique({ where: { id: aMessageId } })).toBeNull();
    expect(
      await db.complaintMessage.findMany({ where: { complaintId: aComplaintId } })
    ).toHaveLength(0);
  });

  it("B cannot write to A's complaint — status, assignment, or resolution", async () => {
    const db = scopedDb(B.orgId);
    const res = await db.complaint.updateMany({
      where: { id: aComplaintId },
      data: { status: "resolved", resolutionNote: "hijacked" },
    });
    expect(res.count).toBe(0);
    const untouched = await owner.complaint.findUniqueOrThrow({
      where: { id: aComplaintId },
    });
    expect(untouched.status).toBe("open");
    expect(untouched.resolutionNote).toBeNull();
  });

  it("B cannot assign A's complaint to one of its own users", async () => {
    const db = scopedDb(B.orgId);
    const res = await db.complaint.updateMany({
      where: { id: aComplaintId },
      data: { assignedToId: B.users.finance_admin },
    });
    expect(res.count).toBe(0);
    const row = await owner.complaint.findUniqueOrThrow({ where: { id: aComplaintId } });
    expect(row.assignedToId).toBe(A.users.finance_admin);
  });

  it("B cannot post into A's thread", async () => {
    const db = scopedDb(B.orgId);
    await expect(
      db.complaintMessage.create({
        data: {
          orgId: B.orgId,
          complaintId: aComplaintId, // A's complaint — invisible under B's RLS
          authorId: B.users.employee,
          body: "injected",
        },
      })
    ).rejects.toThrow();
    expect(
      await owner.complaintMessage.count({ where: { complaintId: aComplaintId } })
    ).toBe(1);
  });

  it("B cannot raise a complaint against A's report or payment", async () => {
    const db = scopedDb(B.orgId);
    await expect(
      db.complaint.create({
        data: {
          orgId: B.orgId,
          raisedById: B.users.employee,
          reportId: A.reportId,
          type: "unfair_rejection",
          description: "not my report",
        },
      })
    ).rejects.toThrow();
    await expect(
      db.complaint.create({
        data: {
          orgId: B.orgId,
          raisedById: B.users.employee,
          reimbursementId: aPaymentId,
          type: "payment_not_received",
          description: "not my payment",
        },
      })
    ).rejects.toThrow();
  });

  it("B's org_admin has no more reach than B's employee", async () => {
    // scopedDb carries no role — the org boundary is the only boundary, so an
    // admin session in B sees exactly what any B user sees: nothing of A's.
    const db = scopedDb(B.orgId);
    expect(await db.complaint.count({})).toBe(0);
    expect(await db.complaintMessage.count({})).toBe(0);
  });

  it("A still sees its own complaint, thread and target", async () => {
    const db = scopedDb(A.orgId);
    const row = await db.complaint.findUnique({
      where: { id: aComplaintId },
      include: { messages: true, report: { select: { id: true } } },
    });
    expect(row?.id).toBe(aComplaintId);
    expect(row?.messages).toHaveLength(1);
    expect(row?.report?.id).toBe(A.reportId);
  });
});

describe("exactly-one-target constraint", () => {
  it("rejects a complaint with both a report and a payment", async () => {
    const db = scopedDb(A.orgId);
    await expect(
      db.complaint.create({
        data: {
          orgId: A.orgId,
          raisedById: A.users.employee,
          reportId: A.reportId,
          reimbursementId: aPaymentId,
          type: "wrong_amount",
          description: "both targets set",
        },
      })
    ).rejects.toThrow();
  });

  it("rejects a complaint with neither", async () => {
    const db = scopedDb(A.orgId);
    await expect(
      db.complaint.create({
        data: {
          orgId: A.orgId,
          raisedById: A.users.employee,
          type: "other",
          description: "no target at all",
        },
      })
    ).rejects.toThrow();
  });

  it("accepts a payment-only complaint", async () => {
    const db = scopedDb(A.orgId);
    const c = await db.complaint.create({
      data: {
        orgId: A.orgId,
        raisedById: A.users.employee,
        reimbursementId: aPaymentId,
        type: "payment_not_received",
        description: "Nothing landed in my account.",
      },
    });
    expect(c.reportId).toBeNull();
    expect(c.reimbursementId).toBe(aPaymentId);
  });
});

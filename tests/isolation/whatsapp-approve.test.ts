// Authz + isolation for 8.3 quick approve. The button is a shortcut, never a
// second authorization path: the same guards that protect the web approval
// screen must hold when the tap arrives over WhatsApp.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { handleQuickApprove } from "@/lib/whatsapp/approve";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

let A: OrgFixture;
let B: OrgFixture;

async function submittedReport(
  org: OrgFixture,
  opts: { flagged?: boolean; title?: string } = {}
): Promise<string> {
  const report = await owner.expenseReport.create({
    data: {
      orgId: org.orgId,
      userId: org.users.employee,
      title: opts.title ?? "WhatsApp approve test",
      status: "submitted",
      submittedAt: new Date(),
      total: 50000,
    },
  });
  await owner.expense.create({
    data: {
      orgId: org.orgId,
      userId: org.users.employee,
      reportId: report.id,
      amount: 50000,
      baseAmount: 50000,
      fxRate: "1",
      currency: "INR",
      date: new Date("2026-08-12"),
      merchant: "Indigo",
      categoryId: org.categoryId,
      status: "submitted",
      flags: opts.flagged
        ? [{ rule: "per_expense_limit", message: "Above the per-expense limit." }]
        : [],
    },
  });
  return report.id;
}

beforeAll(async () => {
  A = await provisionOrg("waap-a");
  B = await provisionOrg("waap-b");
  // employee -> approver routing, as the web path expects
  for (const org of [A, B]) {
    await owner.user.update({
      where: { id: org.users.employee },
      data: { approverId: org.users.approver },
    });
  }
});

afterAll(async () => {
  const orgs = [A.orgId, B.orgId];
  await owner.whatsAppOutbound.deleteMany({ where: { orgId: { in: orgs } } });
  await owner.whatsAppLink.deleteMany({ where: { orgId: { in: orgs } } });
  await teardownOrgs(orgs);
  await owner.$disconnect();
});

describe("quick approve authorization", () => {
  it("approves a clean report and records the whatsapp channel", async () => {
    const reportId = await submittedReport(A, { title: "Clean report" });
    const res = await handleQuickApprove(
      scopedDb(A.orgId),
      A.orgId,
      { userId: A.users.approver, role: "approver" },
      "approve",
      reportId
    );
    expect(res.reply).toMatch(/approved/i);

    const report = await owner.expenseReport.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.status).toBe("approved");
    const approval = await owner.approval.findFirstOrThrow({ where: { reportId } });
    expect(approval.approverId).toBe(A.users.approver);
    const audit = await owner.auditLog.findFirstOrThrow({
      where: { entityId: reportId, action: "report.approved" },
    });
    expect((audit.meta as { channel?: string }).channel).toBe("whatsapp");
  });

  it("is idempotent — a second tap changes nothing", async () => {
    const reportId = await submittedReport(A, { title: "Double tap" });
    const db = scopedDb(A.orgId);
    const actor = { userId: A.users.approver, role: "approver" as const };
    const first = await handleQuickApprove(db, A.orgId, actor, "approve", reportId);
    expect(first.reply).toMatch(/approved/i);
    const second = await handleQuickApprove(db, A.orgId, actor, "approve", reportId);
    expect(second.reply).not.toMatch(/^Approved/i);
    expect(await owner.approval.count({ where: { reportId } })).toBe(1);
    const report = await owner.expenseReport.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.status).toBe("approved");
  });

  it("REFUSES a policy-flagged report from chat", async () => {
    const reportId = await submittedReport(A, { flagged: true, title: "Flagged" });
    const res = await handleQuickApprove(
      scopedDb(A.orgId),
      A.orgId,
      { userId: A.users.approver, role: "approver" },
      "approve",
      reportId
    );
    expect(res.reply).toMatch(/flags/i);
    const report = await owner.expenseReport.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.status).toBe("submitted");
    expect(await owner.approval.count({ where: { reportId } })).toBe(0);
  });

  it("blocks self-approval even for an approver", async () => {
    const report = await owner.expenseReport.create({
      data: {
        orgId: A.orgId,
        userId: A.users.approver, // the approver's OWN report
        title: "Mine",
        status: "submitted",
        submittedAt: new Date(),
        total: 1000,
      },
    });
    const res = await handleQuickApprove(
      scopedDb(A.orgId),
      A.orgId,
      { userId: A.users.approver, role: "approver" },
      "approve",
      report.id
    );
    expect(res.reply).toMatch(/not able/i);
    const after = await owner.expenseReport.findUniqueOrThrow({ where: { id: report.id } });
    expect(after.status).toBe("submitted");
  });

  it("rejects a tap from someone without the approver role", async () => {
    const reportId = await submittedReport(A, { title: "Employee tap" });
    const res = await handleQuickApprove(
      scopedDb(A.orgId),
      A.orgId,
      { userId: A.users.employee, role: "employee" },
      "approve",
      reportId
    );
    expect(res.reply).toMatch(/not able/i);
    expect(await owner.approval.count({ where: { reportId } })).toBe(0);
  });

  it("only ever offers a link for the Open action", async () => {
    const reportId = await submittedReport(A, { title: "Open only" });
    const res = await handleQuickApprove(
      scopedDb(A.orgId),
      A.orgId,
      { userId: A.users.approver, role: "approver" },
      "open",
      reportId
    );
    expect(res.reply).toContain(reportId);
    const report = await owner.expenseReport.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.status).toBe("submitted");
  });
});

describe("cross-org quick approve", () => {
  it("B's approver cannot approve A's report by id", async () => {
    const reportId = await submittedReport(A, { title: "A's report" });
    const res = await handleQuickApprove(
      scopedDb(B.orgId),
      B.orgId,
      { userId: B.users.approver, role: "approver" },
      "approve",
      reportId
    );
    expect(res.reply).toMatch(/can't find/i);
    const report = await owner.expenseReport.findUniqueOrThrow({ where: { id: reportId } });
    expect(report.status).toBe("submitted");
    expect(await owner.approval.count({ where: { reportId } })).toBe(0);
  });

  it("outbound send logs stay inside their org", async () => {
    await owner.whatsAppOutbound.create({
      data: {
        orgId: A.orgId,
        userId: A.users.approver,
        toPhone: "+919876500003",
        event: "report.submitted",
        templateName: "report_submitted",
        status: "sent",
        attempts: 1,
      },
    });
    expect(await scopedDb(A.orgId).whatsAppOutbound.count({})).toBe(1);
    expect(await scopedDb(B.orgId).whatsAppOutbound.count({})).toBe(0);
  });
});

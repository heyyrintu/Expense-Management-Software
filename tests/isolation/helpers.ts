// Harness for cross-tenant tests (tenant-isolation-check skill).
//
// - `owner`: superuser client (DIRECT_DATABASE_URL) — provisions fixtures
//   and verifies ground truth (bypasses RLS by design).
// - Code under test always goes through scopedDb / the app-role client.
// - Each suite provisions its own throwaway orgs (unique slugs), so runs
//   are independent of `npm run seed` and safe to repeat.
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const owner = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
});

export type OrgFixture = {
  orgId: string;
  slug: string;
  users: Record<"employee" | "approver" | "finance_admin" | "org_admin", string>;
  categoryId: string;
  expenseId: string;
  reportId: string;
  receiptId: string;
};

export async function provisionOrg(tag: string): Promise<OrgFixture> {
  const slug = `iso-${tag}-${randomUUID().slice(0, 8)}`;
  const org = await owner.organization.create({
    data: { slug, name: `Isolation ${tag}` },
  });

  const roles = ["employee", "approver", "finance_admin", "org_admin"] as const;
  const users = {} as OrgFixture["users"];
  for (const role of roles) {
    const u = await owner.user.create({
      data: {
        orgId: org.id,
        name: `${tag} ${role}`,
        email: `${role}@${slug}.test`,
        role,
        status: "active",
      },
    });
    users[role] = u.id;
  }

  const category = await owner.category.create({
    data: { orgId: org.id, name: "Travel" },
  });

  const report = await owner.expenseReport.create({
    data: { orgId: org.id, userId: users.employee, title: `${tag} report` },
  });

  const expense = await owner.expense.create({
    data: {
      orgId: org.id,
      userId: users.employee,
      reportId: report.id,
      amount: 12345,
      baseAmount: 12345,
      fxRate: "1",
      currency: "INR",
      date: new Date("2026-08-01"),
      merchant: `${tag} Cafe`,
      categoryId: category.id,
      purpose: "isolation fixture",
    },
  });

  const receipt = await owner.receipt.create({
    data: {
      orgId: org.id,
      expenseId: expense.id,
      storageKey: `${org.id}/receipts/${expense.id}/fixture.jpg`,
      fileName: "fixture.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    },
  });

  return {
    orgId: org.id,
    slug,
    users,
    categoryId: category.id,
    expenseId: expense.id,
    reportId: report.id,
    receiptId: receipt.id,
  };
}

/**
 * Hard-delete fixtures (tests only — the app never hard-deletes).
 *
 * ORDER IS THE WHOLE FUNCTION. Every child has to go before its parent, or
 * Postgres refuses the delete on a RESTRICT foreign key and the suite fails
 * in teardown having already passed — which reads as a mystery failure and
 * leaves rows behind for the next run to trip over. Anything referencing
 * `users` in particular belongs above the user delete.
 */
export async function teardownOrgs(orgIds: string[]): Promise<void> {
  const where = { orgId: { in: orgIds } };
  // ORDER IS THE WHOLE FUNCTION. Every child has to go before its parent, or
  // Postgres refuses the delete on a RESTRICT foreign key and the suite fails
  // in teardown having already passed — which reads as a mystery failure and
  // leaves rows behind for the NEXT file to trip over. That is exactly how
  // per-diem and accounting-export came to fail at suite level: the list
  // below used to stop at `departments`, so every table added after 5.x
  // (per_diem_rates, advances, complaints, the whatsapp and bank tables...)
  // kept its rows and blocked the organizations delete.
  //
  // Deletes run through the OWNER client, which bypasses RLS by design —
  // fixtures span two orgs and teardown has to reach both.
  for (const del of [
    () => owner.accountingExportReport.deleteMany({ where }),
    () => owner.accountingExport.deleteMany({ where }),
    () => owner.accountingMapping.deleteMany({ where }),
    () => owner.bankStatementLine.deleteMany({ where }),
    () => owner.bankStatementImport.deleteMany({ where }),
    () => owner.complaintMessage.deleteMany({ where }),
    () => owner.complaint.deleteMany({ where }),
    () => owner.reportComment.deleteMany({ where }),
    () => owner.expenseSplit.deleteMany({ where }),
    () => owner.receipt.deleteMany({ where }),
    () => owner.approval.deleteMany({ where }),
    () => owner.whatsAppOutbound.deleteMany({ where }),
    () => owner.whatsAppInbound.deleteMany({ where }),
    () => owner.whatsAppLink.deleteMany({ where }),
    () => owner.whatsAppAccount.deleteMany({ where }),
    () => owner.cardTransaction.deleteMany({ where }),
    () => owner.notification.deleteMany({ where }),
    () => owner.auditLog.deleteMany({ where }),
    // reimbursements before payment_batches (batch_id), and before expenses
    () => owner.reimbursement.deleteMany({ where }),
    () => owner.paymentBatch.deleteMany({ where }),
    () => owner.expense.deleteMany({ where }),
    () => owner.expenseReport.deleteMany({ where }),
    () => owner.advance.deleteMany({ where }),
    () => owner.recurringTemplate.deleteMany({ where }),
    () => owner.delegation.deleteMany({ where }),
    () => owner.budget.deleteMany({ where }),
    () => owner.approvalRule.deleteMany({ where }),
    () => owner.perDiemRate.deleteMany({ where }),
    () => owner.inboundEmailFailure.deleteMany({ where }),
    () => owner.client.deleteMany({ where }),
    () => owner.category.deleteMany({ where }),
    () => owner.project.deleteMany({ where }),
    () => owner.user.deleteMany({ where }),
    () => owner.department.deleteMany({ where }),
  ]) {
    await del();
  }
  await owner.organization.deleteMany({ where: { id: { in: orgIds } } });
}

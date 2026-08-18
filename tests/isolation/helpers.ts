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

/** Hard-delete fixtures (tests only — the app never hard-deletes). */
export async function teardownOrgs(orgIds: string[]): Promise<void> {
  const where = { orgId: { in: orgIds } };
  await owner.receipt.deleteMany({ where });
  await owner.approval.deleteMany({ where });
  await owner.reimbursement.deleteMany({ where });
  await owner.expense.deleteMany({ where });
  await owner.expenseReport.deleteMany({ where });
  await owner.auditLog.deleteMany({ where });
  await owner.user.deleteMany({ where });
  await owner.category.deleteMany({ where });
  await owner.project.deleteMany({ where });
  await owner.department.deleteMany({ where });
  await owner.organization.deleteMany({ where: { id: { in: orgIds } } });
}

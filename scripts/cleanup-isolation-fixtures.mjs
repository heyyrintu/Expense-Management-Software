// Remove leftover isolation-test fixtures (orgs slugged `iso-*`).
//
// tests/isolation/helpers.ts tears its own orgs down, but a teardown that
// fails part-way — a RESTRICT foreign key it didn't know about — leaves rows
// behind that the next run then trips over. This is the manual broom.
//
//   node scripts/cleanup-isolation-fixtures.mjs
//
// Safe by construction: it only ever touches organizations whose slug starts
// with the `iso-` prefix provisionOrg() uses, never real tenant data.
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
});

const orgs = await prisma.organization.findMany({
  where: { slug: { startsWith: "iso-" } },
  select: { id: true, slug: true },
});

if (orgs.length === 0) {
  console.log("✔ no leftover isolation fixtures");
} else {
  const ids = orgs.map((o) => o.id);
  const where = { orgId: { in: ids } };
  // Same child-before-parent order as teardownOrgs.
  await prisma.receipt.deleteMany({ where });
  await prisma.approval.deleteMany({ where });
  await prisma.reimbursement.deleteMany({ where });
  await prisma.expense.deleteMany({ where });
  await prisma.expenseReport.deleteMany({ where });
  await prisma.auditLog.deleteMany({ where });
  await prisma.notification.deleteMany({ where });
  await prisma.user.deleteMany({ where });
  await prisma.category.deleteMany({ where });
  await prisma.project.deleteMany({ where });
  await prisma.department.deleteMany({ where });
  const deleted = await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  console.log(`✔ removed ${deleted.count} leftover isolation org(s)`);
}

await prisma.$disconnect();

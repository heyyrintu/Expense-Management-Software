// Seed: 2 demo orgs (acme, globex), each with one user per role,
// departments, a project, and starter categories. Idempotent (upserts).
//
// Runs against DIRECT_DATABASE_URL (owner) because seeding spans orgs;
// the app itself always goes through scopedDb(orgId).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
});

const DEMO_PASSWORD = "Password123!";

const ROLES = ["employee", "approver", "finance_admin", "org_admin"] as const;

async function seedOrg(slug: string, name: string) {
  const org = await prisma.organization.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name,
      currency: "INR",
      mileageRate: 1200, // ₹12.00 per km, minor units
      settings: {},
    },
  });

  const engineering = await prisma.department.upsert({
    where: { orgId_name: { orgId: org.id, name: "Engineering" } },
    update: {},
    create: { orgId: org.id, name: "Engineering" },
  });
  await prisma.department.upsert({
    where: { orgId_name: { orgId: org.id, name: "Sales" } },
    update: {},
    create: { orgId: org.id, name: "Sales" },
  });

  await prisma.project.upsert({
    where: { orgId_code: { orgId: org.id, code: "GEN" } },
    update: {},
    create: { orgId: org.id, code: "GEN", name: "General" },
  });

  const categories: Array<{
    name: string;
    perExpenseLimit: number | null;
    monthlyLimit: number | null;
    receiptRequiredAbove: number | null;
  }> = [
    { name: "Travel", perExpenseLimit: 2000000, monthlyLimit: 10000000, receiptRequiredAbove: 50000 },
    { name: "Meals", perExpenseLimit: 200000, monthlyLimit: 1000000, receiptRequiredAbove: 20000 },
    { name: "Office Supplies", perExpenseLimit: 500000, monthlyLimit: null, receiptRequiredAbove: 10000 },
    { name: "Mileage", perExpenseLimit: null, monthlyLimit: null, receiptRequiredAbove: null },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { orgId_name: { orgId: org.id, name: c.name } },
      update: {},
      create: { orgId: org.id, ...c },
    });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, { id: string }> = {};
  for (const role of ROLES) {
    const email = `${role}@${slug}.test`;
    users[role] = await prisma.user.upsert({
      where: { orgId_email: { orgId: org.id, email } },
      update: {},
      create: {
        orgId: org.id,
        email,
        name: `${name} ${role.replace("_", " ")}`,
        role,
        status: "active",
        passwordHash,
        departmentId: engineering.id,
      },
    });
  }

  // employee reports to approver; approver reports to finance_admin
  await prisma.user.update({
    where: { id: users.employee.id },
    data: { approverId: users.approver.id },
  });
  await prisma.user.update({
    where: { id: users.approver.id },
    data: { approverId: users.finance_admin.id },
  });

  console.log(`seeded org ${slug} (${org.id})`);
}

async function main() {
  await seedOrg("acme", "Acme");
  await seedOrg("globex", "Globex");
  console.log(`demo login password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

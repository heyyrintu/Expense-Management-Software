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
      settings: { secondApprovalAbove: 5000000, expenseAgeLimitDays: 90 },
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
    // Deliberately carries a receipt threshold: a per-diem filed against it
    // must still come out unflagged, which is what proves the exemption in
    // lib/domain/policy.ts is doing something rather than being untested.
    { name: "Per diem", perExpenseLimit: 1500000, monthlyLimit: null, receiptRequiredAbove: 10000 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { orgId_name: { orgId: org.id, name: c.name } },
      update: {},
      create: { orgId: org.id, ...c },
    });
  }

  // Per-diem rates, WITH A HISTORY — two versions of "Metro" so both demo orgs
  // exercise the effective-date lookup rather than the trivial single-row
  // case. A trip in March 2026 prices at ₹2,000/day; one in August at ₹2,500.
  const perDiemRates: Array<{
    name: string;
    location: string | null;
    dailyAmount: number;
    effectiveFrom: Date;
  }> = [
    { name: "Metro", location: "Mumbai / Delhi / Bengaluru", dailyAmount: 200000, effectiveFrom: new Date("2025-04-01T00:00:00.000Z") },
    { name: "Metro", location: "Mumbai / Delhi / Bengaluru", dailyAmount: 250000, effectiveFrom: new Date("2026-04-01T00:00:00.000Z") },
    { name: "Non-metro", location: null, dailyAmount: 120000, effectiveFrom: new Date("2025-04-01T00:00:00.000Z") },
  ];
  for (const r of perDiemRates) {
    await prisma.perDiemRate.upsert({
      where: {
        orgId_name_effectiveFrom: {
          orgId: org.id,
          name: r.name,
          effectiveFrom: r.effectiveFrom,
        },
      },
      update: {},
      create: { orgId: org.id, ...r },
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

  // sample budgets: monthly Travel category + Engineering department
  const travel = await prisma.category.findUniqueOrThrow({
    where: { orgId_name: { orgId: org.id, name: "Travel" } },
  });
  await prisma.budget.upsert({
    where: {
      orgId_scopeType_scopeId_period: {
        orgId: org.id,
        scopeType: "category",
        scopeId: travel.id,
        period: "monthly",
      },
    },
    update: {},
    create: {
      orgId: org.id,
      scopeType: "category",
      scopeId: travel.id,
      period: "monthly",
      amount: 20000000, // ₹2,00,000
    },
  });
  await prisma.budget.upsert({
    where: {
      orgId_scopeType_scopeId_period: {
        orgId: org.id,
        scopeType: "department",
        scopeId: engineering.id,
        period: "monthly",
      },
    },
    update: {},
    create: {
      orgId: org.id,
      scopeType: "department",
      scopeId: engineering.id,
      period: "monthly",
      amount: 50000000, // ₹5,00,000
    },
  });

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
  await prisma.superAdmin.upsert({
    where: { email: "superadmin@platform.test" },
    update: {},
    create: {
      email: "superadmin@platform.test",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    },
  });
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

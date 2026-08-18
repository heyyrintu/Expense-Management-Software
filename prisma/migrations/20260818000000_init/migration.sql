-- Migration: init (schema v1, PLAN 0.2)
-- Additive-only baseline. Includes RLS enable/force + tenant_isolation
-- policy on every tenant table (defense-in-depth; app-side scoping via
-- scopedDb comes in PLAN 0.3, which sets app.current_org_id per tx).

-- CreateEnum
CREATE TYPE "role" AS ENUM ('employee', 'approver', 'finance_admin', 'org_admin');

-- CreateEnum
CREATE TYPE "org_status" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('invited', 'active', 'deactivated');

-- CreateEnum
CREATE TYPE "expense_type" AS ENUM ('regular', 'mileage');

-- CreateEnum
CREATE TYPE "expense_status" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'reimbursed');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'sent_back', 'reimbursed');

-- CreateEnum
CREATE TYPE "approval_action" AS ENUM ('approved', 'rejected', 'sent_back');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "mileage_rate" INTEGER NOT NULL DEFAULT 0,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" "org_status" NOT NULL DEFAULT 'active',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "role" NOT NULL DEFAULT 'employee',
    "department_id" UUID,
    "approver_id" UUID,
    "status" "user_status" NOT NULL DEFAULT 'invited',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "per_expense_limit" INTEGER,
    "monthly_limit" INTEGER,
    "receipt_required_above" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "report_id" UUID,
    "type" "expense_type" NOT NULL DEFAULT 'regular',
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "merchant" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "project_id" UUID,
    "purpose" TEXT NOT NULL DEFAULT '',
    "distance_km" INTEGER,
    "status" "expense_status" NOT NULL DEFAULT 'draft',
    "flags" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "ocr_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_reports" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "total" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "action" "approval_action" NOT NULL,
    "reason" TEXT,
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursements" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "paid_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE INDEX "users_org_id_role_idx" ON "users"("org_id", "role");

-- CreateIndex
CREATE INDEX "users_org_id_department_id_idx" ON "users"("org_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_org_id_email_key" ON "users"("org_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "departments_org_id_name_key" ON "departments"("org_id", "name");

-- CreateIndex
CREATE INDEX "projects_org_id_name_idx" ON "projects"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_org_id_code_key" ON "projects"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_org_id_name_key" ON "categories"("org_id", "name");

-- CreateIndex
CREATE INDEX "expenses_org_id_user_id_amount_date_idx" ON "expenses"("org_id", "user_id", "amount", "date");

-- CreateIndex
CREATE INDEX "expenses_org_id_report_id_idx" ON "expenses"("org_id", "report_id");

-- CreateIndex
CREATE INDEX "expenses_org_id_category_id_date_idx" ON "expenses"("org_id", "category_id", "date");

-- CreateIndex
CREATE INDEX "expenses_org_id_status_idx" ON "expenses"("org_id", "status");

-- CreateIndex
CREATE INDEX "receipts_org_id_expense_id_idx" ON "receipts"("org_id", "expense_id");

-- CreateIndex
CREATE INDEX "expense_reports_org_id_user_id_status_idx" ON "expense_reports"("org_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "expense_reports_org_id_status_submitted_at_idx" ON "expense_reports"("org_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "approvals_org_id_report_id_idx" ON "approvals"("org_id", "report_id");

-- CreateIndex
CREATE INDEX "approvals_org_id_approver_id_acted_at_idx" ON "approvals"("org_id", "approver_id", "acted_at");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursements_report_id_key" ON "reimbursements"("report_id");

-- CreateIndex
CREATE INDEX "reimbursements_org_id_paid_at_idx" ON "reimbursements"("org_id", "paid_at");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_entity_entity_id_idx" ON "audit_logs"("org_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_timestamp_idx" ON "audit_logs"("org_id", "timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (defense-in-depth; db-migration skill step 3).
-- current_setting(..., true) returns NULL when app.current_org_id is unset,
-- so the policy matches zero rows instead of erroring.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'departments', 'projects', 'categories', 'expenses',
    'receipts', 'expense_reports', 'approvals', 'reimbursements', 'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (org_id = current_setting(''app.current_org_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;

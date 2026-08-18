-- Migration: budgets (PLAN 5.1). Additive only.

-- CreateEnum
CREATE TYPE "budget_scope" AS ENUM ('department', 'project', 'category');

-- CreateEnum
CREATE TYPE "budget_period" AS ENUM ('monthly', 'quarterly', 'yearly');

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "scope_type" "budget_scope" NOT NULL,
    "scope_id" UUID NOT NULL,
    "period" "budget_period" NOT NULL DEFAULT 'monthly',
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budgets_org_id_scope_type_idx" ON "budgets"("org_id", "scope_type");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_org_id_scope_type_scope_id_period_key" ON "budgets"("org_id", "scope_type", "scope_id", "period");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "budgets"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

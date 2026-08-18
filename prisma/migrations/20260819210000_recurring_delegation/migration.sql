-- Migration: recurring templates + delegation (PLAN 6.5). Additive only.

-- CreateEnum
CREATE TYPE "recurring_cadence" AS ENUM ('monthly', 'weekly');

-- CreateTable
CREATE TABLE "recurring_templates" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cadence" "recurring_cadence" NOT NULL,
    "day" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "category_id" UUID NOT NULL,
    "merchant" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "delegate_id" UUID NOT NULL,
    "principal_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_templates_org_id_user_id_idx" ON "recurring_templates"("org_id", "user_id");
CREATE INDEX "recurring_templates_org_id_active_idx" ON "recurring_templates"("org_id", "active");
CREATE UNIQUE INDEX "delegations_org_id_delegate_id_principal_id_key" ON "delegations"("org_id", "delegate_id", "principal_id");
CREATE INDEX "delegations_org_id_delegate_id_active_idx" ON "delegations"("org_id", "delegate_id", "active");

-- AddForeignKey
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "recurring_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurring_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "recurring_templates"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE "delegations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delegations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "delegations"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Migration: approval_rules (PLAN 5.4). Additive only.
-- approver ids are validated in-org at the action layer; no FK to users so
-- rules survive user role changes (dangling approvers simply never match an
-- eligible actor and are visible in the settings UI).

-- CreateTable
CREATE TABLE "approval_rules" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" UUID,
    "above_amount" INTEGER,
    "approver_id" UUID NOT NULL,
    "second_approver_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_rules_org_id_department_id_idx" ON "approval_rules"("org_id", "department_id");

-- AddForeignKey
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "approval_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "approval_rules"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

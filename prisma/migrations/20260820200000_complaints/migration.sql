-- Migration: expense-linked complaints (PLAN 7.3). Additive only.

-- CreateEnum
CREATE TYPE "complaint_type" AS ENUM ('wrong_amount', 'unfair_rejection', 'payment_not_received', 'other');
CREATE TYPE "complaint_status" AS ENUM ('open', 'in_review', 'resolved', 'wont_fix');

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "raised_by_id" UUID NOT NULL,
    "report_id" UUID,
    "reimbursement_id" UUID,
    "type" "complaint_type" NOT NULL,
    "description" TEXT NOT NULL,
    "attachment_key" TEXT,
    "status" "complaint_status" NOT NULL DEFAULT 'open',
    "assigned_to_id" UUID,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_messages" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_messages_pkey" PRIMARY KEY ("id")
);

-- Exactly one target: a complaint disputes a report OR a payment, never both,
-- never neither. Mirrored in lib/domain/complaint.ts (complaintTargetOf).
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_exactly_one_target"
  CHECK (("report_id" IS NOT NULL)::int + ("reimbursement_id" IS NOT NULL)::int = 1);

-- CreateIndex
CREATE INDEX "complaints_org_id_status_created_at_idx" ON "complaints"("org_id", "status", "created_at");
CREATE INDEX "complaints_org_id_raised_by_id_created_at_idx" ON "complaints"("org_id", "raised_by_id", "created_at");
CREATE INDEX "complaints_org_id_assigned_to_id_status_idx" ON "complaints"("org_id", "assigned_to_id", "status");
CREATE INDEX "complaint_messages_org_id_complaint_id_created_at_idx" ON "complaint_messages"("org_id", "complaint_id", "created_at");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reimbursement_id_fkey" FOREIGN KEY ("reimbursement_id") REFERENCES "reimbursements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "complaints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "complaints" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "complaints"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE "complaint_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "complaint_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "complaint_messages"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

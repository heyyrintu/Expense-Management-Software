-- Migration: reimbursement upgrade (PLAN 6.1).
-- Additive except: reimbursements.report_id UNIQUE is relaxed to a plain
-- index (a report may now receive several partial payments — no data loss,
-- existing single rows remain valid).

-- AlterEnum
ALTER TYPE "report_status" ADD VALUE 'partially_reimbursed' BEFORE 'reimbursed';

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('bank_transfer', 'upi', 'cash', 'payroll');

-- AlterTable: employee bank details (nullable; masked at display)
ALTER TABLE "users" ADD COLUMN "bank_account_name" TEXT;
ALTER TABLE "users" ADD COLUMN "bank_account_number" TEXT;
ALTER TABLE "users" ADD COLUMN "bank_ifsc" TEXT;
ALTER TABLE "users" ADD COLUMN "upi_id" TEXT;

-- CreateTable
CREATE TABLE "payment_batches" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL DEFAULT 'bank_transfer',
    "paid_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_batches_org_id_paid_at_idx" ON "payment_batches"("org_id", "paid_at");

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: reimbursements become payment records
DROP INDEX "reimbursements_report_id_key";
CREATE INDEX "reimbursements_org_id_report_id_idx" ON "reimbursements"("org_id", "report_id");
ALTER TABLE "reimbursements" ADD COLUMN "amount_paid" INTEGER NOT NULL DEFAULT 0;
UPDATE "reimbursements" SET "amount_paid" = "amount";
ALTER TABLE "reimbursements" ALTER COLUMN "amount_paid" DROP DEFAULT;
ALTER TABLE "reimbursements" ADD COLUMN "method" "payment_method" NOT NULL DEFAULT 'bank_transfer';
ALTER TABLE "reimbursements" ADD COLUMN "batch_id" UUID;
ALTER TABLE "reimbursements" ADD COLUMN "proof_key" TEXT;
CREATE INDEX "reimbursements_org_id_batch_id_idx" ON "reimbursements"("org_id", "batch_id");

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security for the new table (db-migration skill step 3)
ALTER TABLE "payment_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_batches"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

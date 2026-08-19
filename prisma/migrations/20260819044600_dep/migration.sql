-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_reimbursement_id_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_report_id_fkey";

-- DropIndex
DROP INDEX "whatsapp_inbound_org_id_expense_id_idx";

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reimbursement_id_fkey" FOREIGN KEY ("reimbursement_id") REFERENCES "reimbursements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

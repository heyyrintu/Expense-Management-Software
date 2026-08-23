-- Complaint FK behaviour + drop of a superseded WhatsApp index.
--
-- ── RENAMED, NOT REWRITTEN (2026-08-23) ───────────────────────────────────
-- This was `20260819044600_dep`, which sorted SEVENTH — before the objects it
-- alters exist. Prisma applies migrations in folder-name order, so on any
-- empty database it failed with:
--     P3006 … failed to apply cleanly to the shadow database
--     P1014 The underlying table for model `complaints` does not exist
-- It only ever "worked" on the dev database because those objects had been
-- created out of band.
--
-- Its dependencies:
--   • `complaints` and its two FK constraints → 20260820200000_complaints
--   • `whatsapp_inbound_org_id_expense_id_idx` → 20260821140000_whatsapp_capture
-- so the folder is now timestamped after 20260821180000_whatsapp_notifications.
--
-- THE SQL BELOW IS UNCHANGED. The statements were always correct; only their
-- position was wrong. Both changes are also the end state schema.prisma
-- expects — the relations are optional (Prisma defaults them to SET NULL) and
-- WhatsAppInbound declares no (org_id, expense_id) index — so before this fix
-- an already-migrated database was DRIFTED from the schema in two ways, not
-- merely unreplayable.
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

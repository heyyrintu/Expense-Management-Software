-- Migration: WhatsApp receipt capture (PLAN 8.2). Additive only.
-- Links an inbound message to the draft expense it produced so the
-- Confirm/Edit/Discard button callbacks are idempotent.

-- AlterTable
ALTER TABLE "whatsapp_inbound" ADD COLUMN "expense_id" UUID;

-- AddForeignKey
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "whatsapp_inbound_org_id_expense_id_idx" ON "whatsapp_inbound"("org_id", "expense_id");

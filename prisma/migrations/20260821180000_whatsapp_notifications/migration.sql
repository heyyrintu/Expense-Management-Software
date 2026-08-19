-- Migration: WhatsApp notifications + quick approve (PLAN 8.3). Additive only.

-- CreateEnum
CREATE TYPE "whatsapp_outbound_status" AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

-- AlterTable: last inbound message opens Meta's 24-hour session window
ALTER TABLE "whatsapp_links" ADD COLUMN "last_inbound_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "whatsapp_outbound" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID,
    "to_phone" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "template_name" TEXT,
    "wa_message_id" TEXT,
    "status" "whatsapp_outbound_status" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_outbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_outbound_wa_message_id_key" ON "whatsapp_outbound"("wa_message_id");
CREATE INDEX "whatsapp_outbound_org_id_status_created_at_idx" ON "whatsapp_outbound"("org_id", "status", "created_at");
CREATE INDEX "whatsapp_outbound_org_id_user_id_created_at_idx" ON "whatsapp_outbound"("org_id", "user_id", "created_at");

-- AddForeignKey
ALTER TABLE "whatsapp_outbound" ADD CONSTRAINT "whatsapp_outbound_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_outbound" ADD CONSTRAINT "whatsapp_outbound_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "whatsapp_outbound" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_outbound" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_outbound"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

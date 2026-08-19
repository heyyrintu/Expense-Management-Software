-- Migration: WhatsApp channel infrastructure (PLAN 8.1). Additive only.
-- Credentials are written already-encrypted by the application
-- (lib/crypto/secret-box.ts); the database never sees plaintext tokens.

-- CreateEnum
CREATE TYPE "whatsapp_inbound_status" AS ENUM ('pending', 'processed', 'ignored', 'failed');

-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "phone_number_id" TEXT NOT NULL,
    "business_phone" TEXT NOT NULL,
    "token_cipher" TEXT,
    "app_secret_cipher" TEXT,
    "verify_token_cipher" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_links" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "otp_hash" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "opted_out" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_inbound" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "wa_message_id" TEXT NOT NULL,
    "from_phone" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "user_id" UUID,
    "message_type" TEXT NOT NULL,
    "text" TEXT,
    "media_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "whatsapp_inbound_status" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_inbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- phone_number_id is globally unique: it routes an inbound webhook to exactly
-- one org before any session/tenant scope exists.
CREATE UNIQUE INDEX "whatsapp_accounts_org_id_key" ON "whatsapp_accounts"("org_id");
CREATE UNIQUE INDEX "whatsapp_accounts_phone_number_id_key" ON "whatsapp_accounts"("phone_number_id");
CREATE UNIQUE INDEX "whatsapp_links_user_id_key" ON "whatsapp_links"("user_id");
-- A number is claimed at most once per org; the SAME number may exist in
-- another org, which is why inbound routing keys on the business number first.
CREATE UNIQUE INDEX "whatsapp_links_org_id_phone_e164_key" ON "whatsapp_links"("org_id", "phone_e164");
CREATE INDEX "whatsapp_links_org_id_verified_at_idx" ON "whatsapp_links"("org_id", "verified_at");
CREATE UNIQUE INDEX "whatsapp_inbound_wa_message_id_key" ON "whatsapp_inbound"("wa_message_id");
CREATE INDEX "whatsapp_inbound_org_id_status_received_at_idx" ON "whatsapp_inbound"("org_id", "status", "received_at");
CREATE INDEX "whatsapp_inbound_org_id_from_phone_received_at_idx" ON "whatsapp_inbound"("org_id", "from_phone", "received_at");

-- AddForeignKey
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_links" ADD CONSTRAINT "whatsapp_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_links" ADD CONSTRAINT "whatsapp_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "whatsapp_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_accounts"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE "whatsapp_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_links"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE "whatsapp_inbound" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_inbound" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_inbound"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

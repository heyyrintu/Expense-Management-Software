-- Migration: inbound email dead letters (PLAN 6.6). Additive only.

-- CreateTable
CREATE TABLE "inbound_email_failures" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "from_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_email_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_email_failures_org_id_created_at_idx" ON "inbound_email_failures"("org_id", "created_at");

-- AddForeignKey
ALTER TABLE "inbound_email_failures" ADD CONSTRAINT "inbound_email_failures_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "inbound_email_failures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inbound_email_failures" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inbound_email_failures"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

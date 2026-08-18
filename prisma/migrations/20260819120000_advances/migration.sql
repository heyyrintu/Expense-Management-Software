-- Migration: advances (PLAN 6.2). Additive only.

-- CreateEnum
CREATE TYPE "advance_status" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'disbursed', 'partially_settled', 'settled');

-- CreateTable
CREATE TABLE "advances" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "trip_start" DATE,
    "trip_end" DATE,
    "status" "advance_status" NOT NULL DEFAULT 'draft',
    "approved_by_id" UUID,
    "disbursed_at" TIMESTAMP(3),
    "disbursement_ref" TEXT,
    "disbursement_proof_key" TEXT,
    "settled_amount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "advances_org_id_user_id_status_idx" ON "advances"("org_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "advances_org_id_status_idx" ON "advances"("org_id", "status");

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "advances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "advances" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "advances"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

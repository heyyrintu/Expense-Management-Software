-- Migration: card_transactions (PLAN 5.2). Additive only.

-- CreateTable
CREATE TABLE "card_transactions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "imported_batch" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "merchant" TEXT NOT NULL,
    "matched_expense_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "card_transactions_matched_expense_id_key" ON "card_transactions"("matched_expense_id");

-- CreateIndex
CREATE INDEX "card_transactions_org_id_matched_expense_id_idx" ON "card_transactions"("org_id", "matched_expense_id");

-- CreateIndex
CREATE INDEX "card_transactions_org_id_imported_batch_idx" ON "card_transactions"("org_id", "imported_batch");

-- CreateIndex
CREATE INDEX "card_transactions_org_id_date_idx" ON "card_transactions"("org_id", "date");

-- AddForeignKey
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_matched_expense_id_fkey" FOREIGN KEY ("matched_expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "card_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "card_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "card_transactions"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

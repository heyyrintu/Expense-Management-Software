-- Migration: bank statement reconciliation (PLAN 7.2). Additive only.

-- CreateEnum
CREATE TYPE "bank_match_type" AS ENUM ('auto', 'manual');

-- CreateTable
CREATE TABLE "bank_statement_imports" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "column_mapping" JSONB NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "locked_at" TIMESTAMP(3),
    "imported_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "matched_reimbursement_id" UUID,
    "match_type" "bank_match_type",

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_statement_imports_org_id_created_at_idx" ON "bank_statement_imports"("org_id", "created_at");
CREATE UNIQUE INDEX "bank_statement_lines_matched_reimbursement_id_key" ON "bank_statement_lines"("matched_reimbursement_id");
CREATE INDEX "bank_statement_lines_org_id_import_id_idx" ON "bank_statement_lines"("org_id", "import_id");
CREATE INDEX "bank_statement_lines_org_id_date_idx" ON "bank_statement_lines"("org_id", "date");

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "bank_statement_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_reimbursement_id_fkey" FOREIGN KEY ("matched_reimbursement_id") REFERENCES "reimbursements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "bank_statement_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_statement_imports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bank_statement_imports"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE "bank_statement_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_statement_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bank_statement_lines"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

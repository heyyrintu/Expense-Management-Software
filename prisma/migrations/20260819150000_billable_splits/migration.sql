-- Migration: billable + split expenses (PLAN 6.3). Additive only.

-- AlterTable: expense billing fields
ALTER TABLE "expenses" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN "client_id" UUID;
ALTER TABLE "expenses" ADD COLUMN "tax_amount" INTEGER;
ALTER TABLE "expenses" ADD COLUMN "tax_number" TEXT;

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_splits" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "project_id" UUID,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "expense_splits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_org_id_code_key" ON "clients"("org_id", "code");
CREATE UNIQUE INDEX "clients_org_id_name_key" ON "clients"("org_id", "name");
CREATE INDEX "expense_splits_org_id_expense_id_idx" ON "expense_splits"("org_id", "expense_id");
CREATE INDEX "expense_splits_org_id_category_id_idx" ON "expense_splits"("org_id", "category_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "clients"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
ALTER TABLE "expense_splits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_splits" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "expense_splits"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

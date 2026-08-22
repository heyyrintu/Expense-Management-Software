-- Migration: per-diem expense type (PRD P1). ADDITIVE ONLY — no backfill
-- needed and nothing to roll back beyond dropping what it adds.
--
-- Note on the PRD: §3 lists "Multi-currency & per-diem engines" as a v1
-- non-goal, and §P1 lists per-diem as nice-to-have. The P1 list wins — the
-- same table defers multi-currency, which shipped as PLAN 6.4. The non-goal
-- row scopes P0, not the product.
--
-- Every new column on `expenses` is NULLABLE, so existing rows are valid
-- without a backfill: a regular or mileage expense simply has no per-diem
-- fields. The enum gains a value and loses none, which Postgres allows in
-- place (CLAUDE.md: enum changes add only).

-- AlterEnum: additive, so no rewrite of existing rows.
--
-- Postgres refuses to USE a newly added enum value in the same transaction
-- that added it (before PG 12 it refused ADD VALUE in a transaction at all).
-- Nothing below writes a 'per_diem' row, so this is safe inside Prisma's
-- migration transaction — but do not add a seed/backfill statement to THIS
-- file that inserts one. Put it in a follow-up migration.
ALTER TYPE "expense_type" ADD VALUE 'per_diem';

-- CreateTable
CREATE TABLE "per_diem_rates" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "daily_amount" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "per_diem_rates_pkey" PRIMARY KEY ("id")
);

-- A rate NAME has a history: several rows, each effective from a date. Two
-- rows for one name starting the same day would be ambiguous rather than a
-- history, so that pair is unique — but (org_id, name) deliberately is NOT.
CREATE UNIQUE INDEX "per_diem_rates_org_id_name_effective_from_key"
    ON "per_diem_rates"("org_id", "name", "effective_from");

-- org_id leads every index. This one also serves the effective-rate lookup,
-- which filters on name and takes the newest effective_from at or before a
-- given date.
CREATE INDEX "per_diem_rates_org_id_name_effective_from_idx"
    ON "per_diem_rates"("org_id", "name", "effective_from");
CREATE INDEX "per_diem_rates_org_id_active_idx"
    ON "per_diem_rates"("org_id", "active");

-- AddForeignKey
ALTER TABLE "per_diem_rates"
    ADD CONSTRAINT "per_diem_rates_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: per-diem fields on expenses, all nullable.
ALTER TABLE "expenses" ADD COLUMN "per_diem_rate_id" UUID;
ALTER TABLE "expenses" ADD COLUMN "per_diem_start" DATE;
ALTER TABLE "expenses" ADD COLUMN "per_diem_end" DATE;
-- Count of HALF-days, so the column stays an integer: 3 full days = 6.
ALTER TABLE "expenses" ADD COLUMN "per_diem_half_days" INTEGER;

-- RESTRICT, not CASCADE or SET NULL: an expense records which rate priced it,
-- and losing that link would leave an amount nobody can re-derive. Retiring a
-- rate is `active = false`, which the UI offers; deleting one that has been
-- used is refused by the database.
ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_per_diem_rate_id_fkey"
    FOREIGN KEY ("per_diem_rate_id") REFERENCES "per_diem_rates"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security — enabled AND forced, so even the table owner is
-- subject to it (db-migration skill; tests/isolation/rls.test.ts asserts
-- every org_id table has both).
ALTER TABLE "per_diem_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "per_diem_rates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "per_diem_rates"
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- No GRANT here on purpose. docker/postgres-init/01-app-role.sql sets ALTER
-- DEFAULT PRIVILEGES for role "expense", so tables created by later
-- migrations grant themselves to expense_app automatically. An explicit GRANT
-- would also FAIL in CI, where the workflow runs `prisma migrate deploy`
-- before creating the role — the grantee would not exist yet.

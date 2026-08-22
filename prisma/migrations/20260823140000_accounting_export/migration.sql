-- Migration: accounting export layer (FINAL-AUDIT §4 — the strategic gap).
-- ADDITIVE ONLY. Nothing existing changes shape, so there is no backfill and
-- the rollback is dropping what this adds.
--
-- Scope note: this is the GROUNDWORK for two-way sync, plus one real one-way
-- adapter (QuickBooks Online journal-entry CSV). No OAuth, no live API calls.
-- The schema is nonetheless shaped for an API adapter — see the comments on
-- accounting_exports.file_key and .remote_ref — because retro-fitting those
-- columns would mean migrating a table that by then holds the audit trail of
-- every export finance has run.

-- CreateEnum
CREATE TYPE "accounting_target" AS ENUM ('quickbooks', 'xero', 'netsuite', 'tally', 'generic');
CREATE TYPE "accounting_entity_type" AS ENUM ('category', 'department', 'project', 'user', 'tax');

-- CreateTable: local record → remote account code.
CREATE TABLE "accounting_mappings" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "target" "accounting_target" NOT NULL,
    "entity_type" "accounting_entity_type" NOT NULL,
    -- No FK: local_id points at one of five tables depending on entity_type,
    -- and Postgres has no polymorphic FK. Resolution goes through the live
    -- entity list rather than this table alone, so a mapping whose target row
    -- was deleted reads as "unmapped" rather than as a stale code.
    "local_id" UUID NOT NULL,
    "remote_code" TEXT NOT NULL,
    "remote_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_mappings_pkey" PRIMARY KEY ("id")
);

-- One mapping per local record PER TARGET: the same category maps to a
-- different code in QuickBooks than in Tally, and both must coexist.
CREATE UNIQUE INDEX "accounting_mappings_org_target_entity_local_key"
    ON "accounting_mappings"("org_id", "target", "entity_type", "local_id");
CREATE INDEX "accounting_mappings_org_id_target_entity_type_idx"
    ON "accounting_mappings"("org_id", "target", "entity_type");

-- CreateTable: one export run.
CREATE TABLE "accounting_exports" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "target" "accounting_target" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exported_by_id" UUID NOT NULL,
    -- NULLABLE on purpose: a future API adapter posts journal entries and
    -- produces no file at all.
    "file_key" TEXT,
    -- Empty until an API adapter exists. Recording what the remote system
    -- called a batch is the difference between "this run happened" and "this
    -- run happened and here is the other system's id for it".
    "remote_ref" TEXT,
    "line_count" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,

    CONSTRAINT "accounting_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accounting_exports_org_id_target_exported_at_idx"
    ON "accounting_exports"("org_id", "target", "exported_at");

-- CreateTable: which reports went into which run.
--
-- A join table rather than a report_ids JSON array. The double-export guard
-- asks "has this report gone to this target?" on every export and on every
-- report detail page; against JSON that is a sequential scan over every
-- export the org has ever made, and it gets slower the longer finance uses
-- the product. Against this table it is an index hit.
CREATE TABLE "accounting_export_reports" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "export_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,

    CONSTRAINT "accounting_export_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_export_reports_org_export_report_key"
    ON "accounting_export_reports"("org_id", "export_id", "report_id");
-- THE double-export guard's lookup.
CREATE INDEX "accounting_export_reports_org_id_report_id_idx"
    ON "accounting_export_reports"("org_id", "report_id");

-- AddForeignKey
ALTER TABLE "accounting_mappings"
    ADD CONSTRAINT "accounting_mappings_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_exports"
    ADD CONSTRAINT "accounting_exports_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_exports"
    ADD CONSTRAINT "accounting_exports_exported_by_id_fkey"
    FOREIGN KEY ("exported_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_export_reports"
    ADD CONSTRAINT "accounting_export_reports_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
-- CASCADE from the header: deleting an export run should not leave orphan
-- lines claiming reports were exported.
ALTER TABLE "accounting_export_reports"
    ADD CONSTRAINT "accounting_export_reports_export_id_fkey"
    FOREIGN KEY ("export_id") REFERENCES "accounting_exports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT on the report: an export record is an audit trail, and a report
-- that has been sent to the ledger must not vanish from it.
ALTER TABLE "accounting_export_reports"
    ADD CONSTRAINT "accounting_export_reports_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security — enabled AND forced on all three, so even the table
-- owner is subject to it (tests/isolation/rls.test.ts asserts both flags on
-- every org_id table).
ALTER TABLE "accounting_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_mappings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounting_mappings"
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE "accounting_exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_exports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounting_exports"
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE "accounting_export_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_export_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounting_export_reports"
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- No GRANT statements: docker/postgres-init/01-app-role.sql sets ALTER
-- DEFAULT PRIVILEGES, and CI creates expense_app AFTER migrating, so an
-- explicit grant here would fail on a grantee that does not exist yet.

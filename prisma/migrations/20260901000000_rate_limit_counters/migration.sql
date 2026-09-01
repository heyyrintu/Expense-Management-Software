-- Shared rate-limit counters (PRD §10).
--
-- The limiter kept its counters in the serving process's memory, so N
-- instances meant roughly N x every limit and a serverless deploy reset them
-- per burst — which made the login limit, the only guard against password
-- guessing, close to no limit at all. Postgres is the shared store because
-- it is already here; a limiter that first requires someone to provision
-- Redis is a limiter that does not work.
--
-- Deliberately NOT tenant-scoped: the login and signup limits are keyed by
-- IP and are recorded BEFORE any session exists, so there is no org to scope
-- them to. No org_id, no RLS, and listed in FORBIDDEN_MODELS so it can never
-- be reached through scopedDb.
--
-- The primary key IS the upsert target: one row per (scope, key, window)
-- rather than one row per request, because these counters are read on every
-- guarded call and a row per request would cost more than the work guarded.

-- CreateTable
CREATE TABLE "rate_limit_counters" (
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("scope","key","window_start")
);

-- CreateIndex
CREATE INDEX "rate_limit_counters_window_start_idx" ON "rate_limit_counters"("window_start");


-- The app role owns nothing, and this table is created by the owner. On a
-- database provisioned with docker/postgres-init/01-app-role.sql the ALTER
-- DEFAULT PRIVILEGES there already covers it; this grant is idempotent and
-- makes the migration self-sufficient on a database where it does not.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'expense_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limit_counters" TO expense_app;
  END IF;
END
$$;

-- Migration: multi-currency (PLAN 6.4). Additive + backfill.
-- Existing expenses were always recorded in the org base currency, so the
-- backfill sets rate=1 and base_amount=amount.

ALTER TABLE "expenses" ADD COLUMN "fx_rate" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "expenses" ADD COLUMN "base_amount" INTEGER NOT NULL DEFAULT 0;

UPDATE "expenses" SET "base_amount" = "amount";

-- keep DEFAULT 0 dropped so future writes must set it explicitly;
-- fx_rate keeps DEFAULT '1' (matches the Prisma model default)
ALTER TABLE "expenses" ALTER COLUMN "base_amount" DROP DEFAULT;

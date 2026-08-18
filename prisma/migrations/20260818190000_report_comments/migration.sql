-- Migration: report_comments (PLAN 5.3). Additive only.

-- CreateTable
CREATE TABLE "report_comments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_comments_org_id_report_id_created_at_idx" ON "report_comments"("org_id", "report_id", "created_at");

-- AddForeignKey
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (db-migration skill step 3)
ALTER TABLE "report_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "report_comments"
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

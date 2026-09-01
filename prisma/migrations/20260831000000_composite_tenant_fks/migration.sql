-- Composite tenant foreign keys: make a cross-org reference IMPOSSIBLE.
--
-- WHY
-- Every FK between two org-scoped tables was single-column — approvals
-- (report_id) -> expense_reports (id), and 44 more like it. Postgres runs
-- referential-integrity checks as the table owner with row security
-- DISABLED, so RLS never sees them: org B could insert a row carrying its
-- own org_id while pointing report_id at org A's report, and both the
-- tenant_isolation policy and scopedDb would wave it through. The isolation
-- suite asserted this was blocked and the comments credited RLS with
-- blocking it; RLS cannot, and never could.
--
-- No data leaked through this — B still cannot READ A's report, and the app
-- resolves every id through a scoped query first. What it allowed was a
-- dangling cross-tenant reference, which CLAUDE.md forbids outright ("no
-- cross-org FKs") because it is the kind of thing one missed scope check
-- turns into a leak.
--
-- HOW
-- Each parent gains UNIQUE (org_id, id) so it can be a composite FK target,
-- and each child FK becomes (org_id, <col>) -> parent (org_id, id). The
-- child's own org_id is now part of the reference, so a row can only ever
-- point at a parent in the SAME org. Postgres enforces it in the constraint
-- itself, which means it holds for raw SQL and any future code path too,
-- not just queries that remember to go through scopedDb.
--
-- Referential actions are carried over unchanged from the constraints being
-- replaced (RESTRICT on delete, CASCADE on update; the one CASCADE delete is
-- accounting_export_reports -> accounting_exports, as before). Nullable
-- child columns keep MATCH SIMPLE semantics: when <col> is NULL the check is
-- skipped, which is what "no report yet" is supposed to mean.

-- DropForeignKey
ALTER TABLE "accounting_export_reports" DROP CONSTRAINT "accounting_export_reports_export_id_fkey";

-- DropForeignKey
ALTER TABLE "accounting_export_reports" DROP CONSTRAINT "accounting_export_reports_report_id_fkey";

-- DropForeignKey
ALTER TABLE "accounting_exports" DROP CONSTRAINT "accounting_exports_exported_by_id_fkey";

-- DropForeignKey
ALTER TABLE "advances" DROP CONSTRAINT "advances_approved_by_id_fkey";

-- DropForeignKey
ALTER TABLE "advances" DROP CONSTRAINT "advances_user_id_fkey";

-- DropForeignKey
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_approver_id_fkey";

-- DropForeignKey
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_report_id_fkey";

-- DropForeignKey
ALTER TABLE "bank_statement_imports" DROP CONSTRAINT "bank_statement_imports_imported_by_id_fkey";

-- DropForeignKey
ALTER TABLE "bank_statement_lines" DROP CONSTRAINT "bank_statement_lines_import_id_fkey";

-- DropForeignKey
ALTER TABLE "bank_statement_lines" DROP CONSTRAINT "bank_statement_lines_matched_reimbursement_id_fkey";

-- DropForeignKey
ALTER TABLE "card_transactions" DROP CONSTRAINT "card_transactions_matched_expense_id_fkey";

-- DropForeignKey
ALTER TABLE "complaint_messages" DROP CONSTRAINT "complaint_messages_author_id_fkey";

-- DropForeignKey
ALTER TABLE "complaint_messages" DROP CONSTRAINT "complaint_messages_complaint_id_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_assigned_to_id_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_raised_by_id_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_reimbursement_id_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_report_id_fkey";

-- DropForeignKey
ALTER TABLE "delegations" DROP CONSTRAINT "delegations_delegate_id_fkey";

-- DropForeignKey
ALTER TABLE "delegations" DROP CONSTRAINT "delegations_principal_id_fkey";

-- DropForeignKey
ALTER TABLE "expense_reports" DROP CONSTRAINT "expense_reports_user_id_fkey";

-- DropForeignKey
ALTER TABLE "expense_splits" DROP CONSTRAINT "expense_splits_category_id_fkey";

-- DropForeignKey
ALTER TABLE "expense_splits" DROP CONSTRAINT "expense_splits_expense_id_fkey";

-- DropForeignKey
ALTER TABLE "expense_splits" DROP CONSTRAINT "expense_splits_project_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_category_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_client_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_per_diem_rate_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_project_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_report_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_batches" DROP CONSTRAINT "payment_batches_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_expense_id_fkey";

-- DropForeignKey
ALTER TABLE "recurring_templates" DROP CONSTRAINT "recurring_templates_category_id_fkey";

-- DropForeignKey
ALTER TABLE "recurring_templates" DROP CONSTRAINT "recurring_templates_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reimbursements" DROP CONSTRAINT "reimbursements_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "reimbursements" DROP CONSTRAINT "reimbursements_paid_by_id_fkey";

-- DropForeignKey
ALTER TABLE "reimbursements" DROP CONSTRAINT "reimbursements_report_id_fkey";

-- DropForeignKey
ALTER TABLE "report_comments" DROP CONSTRAINT "report_comments_author_id_fkey";

-- DropForeignKey
ALTER TABLE "report_comments" DROP CONSTRAINT "report_comments_report_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_approver_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_department_id_fkey";

-- DropForeignKey
ALTER TABLE "whatsapp_inbound" DROP CONSTRAINT "whatsapp_inbound_expense_id_fkey";

-- DropForeignKey
ALTER TABLE "whatsapp_inbound" DROP CONSTRAINT "whatsapp_inbound_user_id_fkey";

-- DropForeignKey
ALTER TABLE "whatsapp_links" DROP CONSTRAINT "whatsapp_links_user_id_fkey";

-- DropForeignKey
ALTER TABLE "whatsapp_outbound" DROP CONSTRAINT "whatsapp_outbound_user_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "accounting_exports_org_id_id_key" ON "accounting_exports"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_imports_org_id_id_key" ON "bank_statement_imports"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_org_id_matched_reimbursement_id_key" ON "bank_statement_lines"("org_id", "matched_reimbursement_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_transactions_org_id_matched_expense_id_key" ON "card_transactions"("org_id", "matched_expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_org_id_id_key" ON "categories"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_org_id_id_key" ON "clients"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_org_id_id_key" ON "complaints"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_org_id_id_key" ON "departments"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_reports_org_id_id_key" ON "expense_reports"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_org_id_id_key" ON "expenses"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_batches_org_id_id_key" ON "payment_batches"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "per_diem_rates_org_id_id_key" ON "per_diem_rates"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_org_id_id_key" ON "projects"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursements_org_id_id_key" ON "reimbursements"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_org_id_id_key" ON "users"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_links_org_id_user_id_key" ON "whatsapp_links"("org_id", "user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_department_id_fkey" FOREIGN KEY ("org_id", "department_id") REFERENCES "departments"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_approver_id_fkey" FOREIGN KEY ("org_id", "approver_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_exports" ADD CONSTRAINT "accounting_exports_org_id_exported_by_id_fkey" FOREIGN KEY ("org_id", "exported_by_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_export_reports" ADD CONSTRAINT "accounting_export_reports_org_id_export_id_fkey" FOREIGN KEY ("org_id", "export_id") REFERENCES "accounting_exports"("org_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_export_reports" ADD CONSTRAINT "accounting_export_reports_org_id_report_id_fkey" FOREIGN KEY ("org_id", "report_id") REFERENCES "expense_reports"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_report_id_fkey" FOREIGN KEY ("org_id", "report_id") REFERENCES "expense_reports"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_category_id_fkey" FOREIGN KEY ("org_id", "category_id") REFERENCES "categories"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_project_id_fkey" FOREIGN KEY ("org_id", "project_id") REFERENCES "projects"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_per_diem_rate_id_fkey" FOREIGN KEY ("org_id", "per_diem_rate_id") REFERENCES "per_diem_rates"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_client_id_fkey" FOREIGN KEY ("org_id", "client_id") REFERENCES "clients"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_org_id_expense_id_fkey" FOREIGN KEY ("org_id", "expense_id") REFERENCES "expenses"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_org_id_report_id_fkey" FOREIGN KEY ("org_id", "report_id") REFERENCES "expense_reports"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_org_id_approver_id_fkey" FOREIGN KEY ("org_id", "approver_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_org_id_report_id_fkey" FOREIGN KEY ("org_id", "report_id") REFERENCES "expense_reports"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_org_id_batch_id_fkey" FOREIGN KEY ("org_id", "batch_id") REFERENCES "payment_batches"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_org_id_paid_by_id_fkey" FOREIGN KEY ("org_id", "paid_by_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_org_id_created_by_id_fkey" FOREIGN KEY ("org_id", "created_by_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_org_id_matched_expense_id_fkey" FOREIGN KEY ("org_id", "matched_expense_id") REFERENCES "expenses"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_org_id_report_id_fkey" FOREIGN KEY ("org_id", "report_id") REFERENCES "expense_reports"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_org_id_author_id_fkey" FOREIGN KEY ("org_id", "author_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_org_id_approved_by_id_fkey" FOREIGN KEY ("org_id", "approved_by_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_org_id_expense_id_fkey" FOREIGN KEY ("org_id", "expense_id") REFERENCES "expenses"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_org_id_category_id_fkey" FOREIGN KEY ("org_id", "category_id") REFERENCES "categories"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_org_id_project_id_fkey" FOREIGN KEY ("org_id", "project_id") REFERENCES "projects"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_org_id_category_id_fkey" FOREIGN KEY ("org_id", "category_id") REFERENCES "categories"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_org_id_delegate_id_fkey" FOREIGN KEY ("org_id", "delegate_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_org_id_principal_id_fkey" FOREIGN KEY ("org_id", "principal_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_org_id_imported_by_id_fkey" FOREIGN KEY ("org_id", "imported_by_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_org_id_import_id_fkey" FOREIGN KEY ("org_id", "import_id") REFERENCES "bank_statement_imports"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_org_id_matched_reimbursement_id_fkey" FOREIGN KEY ("org_id", "matched_reimbursement_id") REFERENCES "reimbursements"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_org_id_raised_by_id_fkey" FOREIGN KEY ("org_id", "raised_by_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_org_id_assigned_to_id_fkey" FOREIGN KEY ("org_id", "assigned_to_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_org_id_report_id_fkey" FOREIGN KEY ("org_id", "report_id") REFERENCES "expense_reports"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_org_id_reimbursement_id_fkey" FOREIGN KEY ("org_id", "reimbursement_id") REFERENCES "reimbursements"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_org_id_complaint_id_fkey" FOREIGN KEY ("org_id", "complaint_id") REFERENCES "complaints"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_org_id_author_id_fkey" FOREIGN KEY ("org_id", "author_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_links" ADD CONSTRAINT "whatsapp_links_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_org_id_expense_id_fkey" FOREIGN KEY ("org_id", "expense_id") REFERENCES "expenses"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_outbound" ADD CONSTRAINT "whatsapp_outbound_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users"("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "accounting_export_reports_org_export_report_key" RENAME TO "accounting_export_reports_org_id_export_id_report_id_key";

-- RenameIndex
ALTER INDEX "accounting_mappings_org_target_entity_local_key" RENAME TO "accounting_mappings_org_id_target_entity_type_local_id_key";


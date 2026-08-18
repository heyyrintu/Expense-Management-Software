# PLAN.md — Build Plan (Claude Code)

Each task ≈ one focused Claude Code session. Do them in order; check off when the Definition of Done in CLAUDE.md is met. Reference: `PRD-expense-management-system.md`.

## Milestone 0 — Foundation

- [x] **0.1 Scaffold**: Next.js 15 + TS strict + Tailwind + shadcn/ui + ESLint; docker-compose (postgres, minio); README run instructions.
- [x] **0.2 Schema v1**: Prisma models — Organization, User, Department, Project, Category, Expense, Receipt, ExpenseReport, Approval, Reimbursement, AuditLog (all with `org_id`, per PRD §7). Migration + ERD comment block.
- [x] **0.3 Tenancy core**: `scopedDb(orgId)` wrapper; Postgres RLS policies on all tenant tables; `app.current_org_id` set per transaction; seed script (2 orgs × 4 roles).
- [x] **0.4 Auth**: Auth.js credentials login; org signup flow (create org + first user = org_admin, slug `app.com/{slug}`); session carries userId/orgId/role; `requireRole()` guards; login/logout/invite-accept pages.
- [x] **0.5 Isolation test harness**: `tests/isolation/` pattern + CI script (`npm run test:isolation`); failing cross-tenant access = red build. GitHub Actions workflow: lint, build, test, isolation.

## Milestone 1 — Expense capture (PRD 6.2)

- [x] **1.1 Categories & org settings**: finance_admin CRUD for categories (limits, receipt threshold), org settings (currency, mileage rate). 
- [x] **1.2 Expense CRUD**: create/edit/delete Draft expenses (amount, date, merchant, category, project, purpose); money as minor units; list + detail views.
- [x] **1.3 Receipt upload**: drag-and-drop JPG/PNG/PDF ≤10 MB → MinIO under org prefix; inline preview via signed URL; multiple receipts per expense.
- [x] **1.4 OCR autofill**: `lib/ocr` interface + Tesseract.js impl; prefill merchant/date/amount with "review extracted values" UI; graceful failure.
- [x] **1.5 Mileage expenses**: type=mileage, distance × org rate auto-amount.

## Milestone 2 — Reports & approvals (PRD 6.3–6.4)

- [x] **2.0 User management**: org_admin screen — list users, invite (email + role + department), edit role/department/**assigned approver**, deactivate. Departments CRUD. Prerequisite for 2.2 approval routing.
- [x] **2.1 Report workflow**: group expenses into report; state machine in `lib/domain/report-workflow.ts` with AuditLog on every transition; withdraw while Submitted.
- [x] **2.2 Approval queue**: approver inbox; approve / reject (reason required) / send back; bulk approve unflagged; self-approval blocked; second-level approval above org threshold.
- [x] **2.3 Notifications**: in-app notification center + email stubs (console/SMTP env) for submit/approve/reject/reimburse events.

## Milestone 3 — Policy engine (PRD 6.5)

- [x] **3.1 Rule engine**: `lib/domain/policy.ts` — per-expense & monthly category limits, receipt-required threshold, expense age, duplicate detection; pure functions + unit tests.
- [x] **3.2 Flag surfacing**: inline warnings at entry time; flag badges in approval queue; approve-with-justification (logged).

## Milestone 4 — Reimbursement & dashboards (PRD 6.6–6.7)

- [x] **4.1 Finance queue**: approved reports list; mark reimbursed (single/batch) with payment date + reference; employee status view.
- [x] **4.2 Dashboards**: employee (my spend/pending), approver (team by month/category), finance (org-wide by category/department/project/user/month, top merchants, violations, avg approval time). Charts: Recharts. Filters + CSV export; numbers must reconcile with filtered lists.
- [x] **4.3 Hardening pass**: e2e happy path (signup → submit → approve → reimburse) in Playwright; empty states; error pages; rate limiting per org; audit review.

**→ MVP complete. Demo with both seed orgs.**

## Milestone 5 — P1 features (post-MVP, in priority order)

- [x] **5.1 Budgets**: per dept/project/category per period; utilization bars; 80%/100% alerts.
- [x] **5.2 Card CSV import + matching**: upload statement, auto-match amount+date ±2 days, unmatched worklist.
- [x] **5.3 Report comments** (approver ? employee thread).
- [x] **5.4 Custom approval chains** by department/amount.
- [x] **5.5 Super Admin panel**: org list, suspend, usage metrics.
- [x] **5.6 Email digests** for pending approvals.

## Milestone 6 — Advanced features (market-parity, in priority order)

- [x] **6.1 Reimbursement upgrade + payment proof**: employee bank details (masked account, IFSC/routing) on profile; finance marks reimbursed with payment method (bank transfer/UPI/cash/payroll), reference/UTR number, and **payment-proof upload (photo/PDF of transfer confirmation)** stored like receipts under org prefix; proof visible to the employee on the report; batch payment run — select many approved reports, one payment batch id, per-report reference; partial reimbursement with remaining-balance tracking; AuditLog on every payment action.
- [ ] **6.2 Cash advances & trip pre-approval**: employee requests advance (amount, purpose, trip dates) → approver flow reuses report workflow; issued advances settle against submitted reports (balance due to employee vs. refund due to org); advance register for finance.
- [ ] **6.3 Billable & split expenses**: mark expense billable to a client/project; split one expense across categories/projects by amount or %; tax fields (GST/VAT number, tax amount) on expense; project-wise billable report + export.
- [ ] **6.4 Multi-currency**: expense in foreign currency with FX rate (manual entry + daily-rate API stub) converted to org base currency; both amounts stored; reports total in base currency.
- [ ] **6.5 Recurring & delegate**: recurring expense templates (e.g., monthly internet) auto-draft on schedule; delegate access — assistant submits on behalf of an executive (acts-as banner, both identities in AuditLog).
- [ ] **6.6 Email receipt ingestion**: per-org inbound address (receipts+{orgslug}@domain) via webhook (e.g., SES/Mailgun stub) → attachment becomes Draft expense with OCR autofill.
- [ ] **6.7 Analytics upgrade**: spend trends over time, policy-violation leaderboard, approval-bottleneck view (avg time per approver), budget vs. actual; scheduled monthly PDF/CSV summary email to finance.

## Milestone 7 — Ledger, reconciliation & complaints (requires 6.1)

- [ ] **7.1 Reimbursement ledger (Tally-style)**: per-user party ledger — dated credit lines (approved report amounts owed to employee, advances as debits) and debit lines (payments with UTR/batch from 6.1), running balance; header totals: requested / approved / paid / **outstanding**. Rollup ledgers per project and per department (same line format, aggregated). Employee sees own ledger; finance/org_admin see all + filters (user, project, dept, date range). Export: **CSV and Tally-importable XML vouchers** (receipt/payment voucher per line, org-configurable ledger names). Numbers must reconcile exactly with report/reimbursement tables.
- [ ] **7.2 Bank statement reconciliation**: upload bank statement CSV/XLSX with a column-mapping step (user picks date/amount/reference columns; save mapping per org); auto-match statement debits ↔ reimbursement records (UTR exact first, then amount + date ±3 days); manual match/unmatch UI; three buckets — matched, **paid-in-app but missing in bank** (red flag), **in bank but not in app** (one-click "record this payment", creating a reimbursement entry that flows into the 7.1 ledger); reconciliation summary (period, matched %, unexplained amount); lock a reconciled period; AuditLog everything.
- [ ] **7.3 Complaints (expense-linked disputes)**: employee raises a complaint from a report/payment — types: wrong amount, unfair rejection, payment not received, other; description + attachment; auto-attaches related payment proof for payment disputes. Routes to finance_admin (never the approver being disputed). States Open → InReview → Resolved/WontFix with mandatory resolution note; 5-business-day SLA badge; complaint thread (comments); employee notified on state change; finance dashboard widget: open complaints + aging. Org B can never see org A complaints (isolation tests).

## Milestone 8 — WhatsApp integration (Meta WhatsApp Business Cloud API)

- [ ] **8.1 Channel infra + number linking**: provider abstraction `lib/whatsapp/` (send text/template/media, verify webhook) — Meta Cloud API implementation, Twilio-swappable; org-level enable toggle + API credentials in org settings; user links their WhatsApp number via OTP (number stored per user, org-scoped, unique per org); inbound webhook route handler with signature verification. Env-gated so the app runs fine without WhatsApp configured.
- [ ] **8.2 Receipt-to-expense over WhatsApp**: user sends receipt photo → matched to user by verified number → media downloaded to org receipt storage → OCR autofill → Draft expense created → bot replies with parsed merchant/amount/date + buttons: ✅ looks right / ✏️ edit (deep link into app) / 🗑 discard. Text-only messages with an amount ("lunch 450") create a draft expense too. Unknown numbers get a polite "link your number in the app" reply. Rate-limit per number.
- [ ] **8.3 Notifications & quick approve**: template messages (24-hr window rules respected) for: report submitted (to approver), approved/rejected/sent-back (to employee), payment done with UTR (to employee), complaint status change. Approver quick actions via reply buttons: Approve / Open in app (reject always requires the app — reason mandatory). Every WhatsApp-triggered action goes through the same guards, state machine, and AuditLog as the web (actor + channel=whatsapp logged); opt-out per user.

## Session protocol (every Claude Code session)

1. Read CLAUDE.md + this file; pick the next unchecked task.
2. Invoke the matching skill from `.claude/skills/`.
3. Implement → tests → `npm run lint && npm run build && npm run test:isolation`.
4. Check the box here, commit (`feat: 2.1 report workflow`), stop. One task per session unless trivial.

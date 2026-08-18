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
- [ ] **4.2 Dashboards**: employee (my spend/pending), approver (team by month/category), finance (org-wide by category/department/project/user/month, top merchants, violations, avg approval time). Charts: Recharts. Filters + CSV export; numbers must reconcile with filtered lists.
- [ ] **4.3 Hardening pass**: e2e happy path (signup → submit → approve → reimburse) in Playwright; empty states; error pages; rate limiting per org; audit review.

**→ MVP complete. Demo with both seed orgs.**

## Milestone 5 — P1 features (post-MVP, in priority order)

- [ ] **5.1 Budgets**: per dept/project/category per period; utilization bars; 80%/100% alerts.
- [ ] **5.2 Card CSV import + matching**: upload statement, auto-match amount+date ±2 days, unmatched worklist.
- [ ] **5.3 Report comments** (approver ↔ employee thread).
- [ ] **5.4 Custom approval chains** by department/amount.
- [ ] **5.5 Super Admin panel**: org list, suspend, usage metrics.
- [ ] **5.6 Email digests** for pending approvals.

## Session protocol (every Claude Code session)

1. Read CLAUDE.md + this file; pick the next unchecked task.
2. Invoke the matching skill from `.claude/skills/`.
3. Implement → tests → `npm run lint && npm run build && npm run test:isolation`.
4. Check the box here, commit (`feat: 2.1 report workflow`), stop. One task per session unless trivial.

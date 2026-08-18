# PRD — Expense Management System

**Version:** 1.1 · **Date:** 2026-08-18 · **Author:** Drona Logitech
**Architecture decision:** Multi-tenant SaaS — one deployment serves many client organizations with strict data isolation.
**Reference product:** Sage Expense Management (formerly Fyle) — fylehq.com

---

## 1. Problem Statement

Businesses process employee expenses manually: paper receipts, spreadsheets, email chains, and month-end data entry into accounting software. Industry data cited by Fyle shows a manual expense report costs ~$58 and 20 minutes to process, with 20% containing errors that cost another ~$52 each to fix. Finance teams lack real-time visibility into spend, employees wait weeks for reimbursements, and month-end close is slowed by unreconciled card transactions and missing receipts.

We will build a web-based expense management system that automates receipt capture, expense reporting, approvals, policy enforcement, reimbursement tracking, and spend analytics — for employees, approvers, and finance admins.

## 2. Goals

1. Reduce time to submit an expense to **under 2 minutes** (receipt upload → coded expense).
2. Reduce expense approval cycle time to **under 1 business day** via automated routing.
3. Catch **100% of policy violations** (duplicates, over-limit, missing receipts) before approval, not after.
4. Give finance real-time spend visibility — dashboard reflects expenses **within seconds** of submission.
5. Cut month-end reconciliation effort by ≥50% through auto-matching and export-ready data.

## 3. Non-Goals (v1)

| Non-goal | Why |
|---|---|
| Real-time bank/card feeds (Visa/Mastercard APIs) | Requires bank partnerships; v1 supports CSV statement import instead |
| ACH payment execution | Regulated money movement; v1 tracks reimbursement status, payment happens outside the system |
| SMS/text-to-expense and email-forwarding ingestion | Needs telephony/email infra; v1 uses web upload + drag-and-drop |
| Native mobile apps | Responsive web app covers mobile; native apps are a v2 initiative |
| Accounting integrations (QuickBooks, Sage, NetSuite, Xero) | v1 provides clean CSV/JSON export; direct sync is P2 |
| Multi-currency & per-diem engines | Single currency (INR/USD configurable) in v1 |

## 4. Personas & Roles

| Role | Description | Primary jobs |
|---|---|---|
| **Employee (Spender)** | Any staff member incurring business expenses | Capture receipts, submit expenses/reports, track reimbursement status |
| **Approver (Manager)** | Team/department lead | Review, approve/reject expenses; see team spend |
| **Finance Admin** | Finance team / controller | Configure policies, categories, budgets; process reimbursements; reports; exports |
| **Org Admin** | System owner | Manage users, roles, departments, org settings |

(Finance Admin and Org Admin may be the same person in small orgs.)

## 5. User Stories

### Employee
- As an employee, I want to upload a receipt photo/PDF and have vendor, date, and amount auto-extracted so I don't type data manually.
- As an employee, I want to create expenses (amount, category, project, purpose, receipt) and group them into an expense report so I can submit once.
- As an employee, I want to log mileage by entering distance (rate auto-applied) so travel claims are consistent.
- As an employee, I want to see policy warnings *before* I submit so my report isn't bounced back.
- As an employee, I want to track each report's status (Draft → Submitted → Approved → Reimbursed) so I know when I'll be paid.

### Approver
- As an approver, I want a queue of pending reports with policy flags highlighted so I can approve compliant ones in one click.
- As an approver, I want to reject with a reason or send back for changes so employees know what to fix.
- As an approver, I want to see my team's monthly spend vs. budget so I can control costs.

### Finance Admin
- As a finance admin, I want to define expense categories, limits per category, and approval chains so policy is enforced automatically.
- As a finance admin, I want automatic duplicate detection (same amount + date + vendor) so we never pay twice.
- As a finance admin, I want to batch-mark approved reports as reimbursed and record payment reference so books stay accurate.
- As a finance admin, I want dashboards (spend by category/department/project/month) and CSV export so close is faster.
- As a finance admin, I want to import a card statement CSV and match transactions to submitted expenses so reconciliation is automated.

### Org Admin
- As an org admin, I want to invite users, assign roles and departments, and set each user's approver so routing works.

## 6. Requirements

### P0 — Must-Have

**6.1 Multi-Tenancy, Auth & Org Setup**
- **Tenant model**: every record belongs to exactly one Organization (tenant). Shared database, shared schema, `org_id` on every table, enforced at the data layer (e.g., PostgreSQL Row-Level Security + mandatory org scoping in the ORM/repository layer — never only in application code).
- **Org signup**: self-serve — first user creates an org and becomes Org Admin; org gets a unique subdomain or slug (`acme.app.com` or `app.com/acme`).
- **Per-org configuration**: currency, mileage rate, categories, policies, approval thresholds, branding (logo/name) are all tenant-scoped.
- Email/password auth with role-based access (Employee, Approver, Finance Admin, Org Admin). A user account belongs to one org; the same email may exist in different orgs as separate accounts.
- User management: invite (email invite scoped to org), deactivate, assign role, department, default approver.
- AC: A user can never read or write another org's data — verified by automated cross-tenant access tests on every endpoint; a deactivated user cannot log in; role determines visible navigation and permitted actions.

**6.1b Platform Administration (Super Admin)**
- Internal-only Super Admin role (not visible to tenants): list orgs, suspend org, view usage metrics (users, expense counts, storage). No access to tenant expense data by default; any support access is logged.
- AC: Suspending an org blocks all its users' logins immediately.

**6.2 Expense Capture**
- Create expense: amount, currency, date, category, merchant, project/cost center, purpose, receipt attachment(s).
- Receipt upload: image (JPG/PNG) and PDF; drag-and-drop; stored and viewable inline.
- OCR auto-fill of merchant, date, amount from receipt (best-effort; user can edit).
- Mileage expense type: distance × configurable rate = amount, auto-calculated.
- AC: Expense saved as Draft is editable/deletable; attached receipt is retrievable; OCR failure still allows manual entry.

**6.3 Expense Reports**
- Group expenses into a report; submit for approval; report states: **Draft → Submitted → Approved / Rejected / Sent Back → Reimbursed**.
- Employee can withdraw a Submitted (not yet approved) report.
- AC: State transitions are logged (who, when); rejected/sent-back reports return expenses to editable state.

**6.4 Approvals**
- Reports route to the submitter's assigned approver; optional second-level approval above a configurable amount threshold.
- Approve / Reject (reason required) / Send back per report; bulk approve for unflagged reports.
- Email/in-app notification on submission, approval, rejection.
- AC: Approver cannot approve their own report; every action is timestamped in an audit trail.

**6.5 Policy Engine**
- Rules configurable by Finance Admin:
  - Per-category spend limit (per expense and per month per user)
  - Receipt required above a threshold amount
  - Expense age limit (e.g., older than 90 days flagged)
  - Duplicate detection: same user + amount + date + merchant
- Violations shown to employee at entry time and to approver as flags; approver may approve with justification (logged).
- AC: A duplicate pair is flagged on both expenses; a violation never silently blocks — it flags with a clear message.

**6.6 Reimbursements**
- Finance queue of Approved reports; mark reimbursed (single or batch) with payment date + reference number.
- Employee sees reimbursement status and history.
- AC: Reimbursed is terminal; amounts roll up correctly to totals.

**6.7 Dashboards & Reporting**
- Employee: my spend summary, pending amounts.
- Approver: team spend by month/category.
- Finance: org-wide spend by category, department, project, user, month; top merchants; violation counts; average approval time.
- Filters: date range, department, category, status. Export any view to CSV.
- AC: Dashboard numbers reconcile exactly with the underlying expense list for the same filters.

### P1 — Nice-to-Have

- **Budgets**: define budget per department/project/category per period; utilization bar + alert at 80%/100%; dashboard warnings.
- **Card statement import**: upload CSV of card transactions; auto-match to expenses on amount+date (±2 days); unmatched transactions listed for follow-up.
- **Custom approval chains**: multi-step chains by department/amount (beyond the P0 two-level rule).
- **Comments** on reports (approver ↔ employee thread).
- **Per-diem** expense type with configurable daily rates.
- **Scheduled email digests**: pending-approvals reminder to approvers.

### P2 — Future

- Direct accounting sync (QuickBooks Online, Sage, Xero, NetSuite) — design export layer with mapping table now.
- Real-time card feeds; virtual cards.
- Text/email receipt ingestion; Gmail/Outlook plugins.
- Native mobile apps; offline capture.
- Multi-currency with FX rates; multi-entity orgs.
- AI copilot for natural-language spend queries.
- ACH payout execution.

## 7. Data Model (core entities)

All entities are tenant-scoped: **every table carries `org_id`** (composite indexes lead with it), and receipts are stored under per-org storage prefixes (`/{org_id}/receipts/...`).

```
Organization (id, slug, name, currency, mileage_rate, plan, status, settings)
User (id, org_id, name, email, role, department_id, approver_id, status)
  -- unique (org_id, email); role ∈ {employee, approver, finance_admin, org_admin}
SuperAdmin (id, email)                                             -- platform-level, no org_id
Department (id, org_id, name)
Project/CostCenter (id, org_id, name, code)
Category (id, org_id, name, per_expense_limit, monthly_limit, receipt_required_above)
Expense (id, user_id, report_id?, type[regular|mileage], amount, currency, date,
         merchant, category_id, project_id, purpose, status, flags[])
Receipt (id, expense_id, file_url, ocr_data{merchant,date,amount})
ExpenseReport (id, user_id, title, status, submitted_at, total)
Approval (id, report_id, approver_id, level, action, reason, acted_at)
Reimbursement (id, report_id, paid_at, reference, amount, paid_by)
Budget (id, scope{dept|project|category}, period, amount)         -- P1
CardTransaction (id, imported_batch, date, amount, merchant,
                 matched_expense_id?)                              -- P1
AuditLog (id, entity, entity_id, actor_id, action, timestamp, meta)
```

## 8. Key Flows

1. **Submit**: Upload receipt → OCR pre-fills → employee completes fields → policy check runs inline → add to report → submit → approver notified.
2. **Approve**: Approver opens queue → flagged items highlighted → approve/reject/send back → employee notified → approved reports enter finance queue.
3. **Reimburse**: Finance filters approved reports → batch mark reimbursed with reference → employee notified → totals update.
4. **Reconcile (P1)**: Import card CSV → auto-match → review unmatched → nudge employees for missing receipts.

## 9. Success Metrics

| Metric | Type | Target (90 days post-launch) |
|---|---|---|
| Median time receipt-upload → submitted expense | Leading | < 2 min |
| Median report approval time | Leading | < 1 business day |
| % expenses with receipt attached (where required) | Leading | > 95% |
| Duplicate payments detected pre-approval | Leading | 100% of exact-match duplicates |
| Finance hours on monthly close (self-reported) | Lagging | −50% |
| Weekly active submitters / eligible employees | Lagging | > 70% |

## 10. Non-Functional Requirements

- **Security**: role-based authorization on every endpoint; **tenant isolation enforced at the database layer (RLS), not just app code**; receipts in private storage with signed URLs under per-org prefixes; audit log for all state changes; passwords hashed (bcrypt/argon2).
- **Tenant isolation testing**: CI suite that attempts cross-org reads/writes for every endpoint must pass before deploy.
- **Scalability**: schema supports per-org growth; noisy-neighbor guard via per-org rate limits; per-org export/delete (data portability, GDPR-style offboarding).
- **Performance**: dashboard loads < 2s at 50k expenses; receipt upload ≤ 10 MB.
- **Data retention**: receipts and expense records retained ≥ 7 years (tax/audit).
- **Availability**: single-region deployment acceptable for v1; daily backups.

## 11. Suggested Tech Stack (for discussion)

- Frontend: React + Tailwind (responsive; mobile-first for capture flow)
- Backend: Node.js (Express/Nest) or Django REST
- DB: PostgreSQL; object storage (S3-compatible) for receipts
- OCR: Tesseract (self-host, free) or a cloud OCR/LLM extraction API for higher accuracy
- Auth: session/JWT + role middleware

## 12. Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | OCR: self-hosted Tesseract vs. paid API (accuracy vs. cost)? | Engineering | No — manual entry fallback exists |
| 2 | ~~Single vs. multi-tenant~~ — **Resolved: multi-tenant SaaS** (shared schema + RLS) | Product/Drona | Resolved 2026-08-18 |
| 6 | Tenant URL scheme: subdomain per org vs. path slug? (subdomains need wildcard DNS/SSL) | Engineering | No — default to path slug, upgrade later |
| 7 | Billing/plans per org (free trial, per-user pricing) in v1 or defer? | Product | No — ship with a single free plan, add billing P1 |
| 3 | Default currency and mileage rate (INR? IRS/company rate)? | Finance | No |
| 4 | Approval hierarchy source — manual assignment or HR org-chart import? | Product | No |
| 5 | Email provider for notifications (SES/SendGrid/SMTP)? | Engineering | No |

## 13. Phasing

- **Phase 1 (MVP)**: 6.1 (multi-tenant foundation + org signup), 6.2–6.4 + basic finance dashboard — usable end-to-end signup→submit→approve→reimburse.
- **Phase 2**: 6.5 policy engine (full), 6.7 complete dashboards/exports.
- **Phase 3 (P1)**: budgets, card CSV import + matching, custom chains, comments.
- **Phase 4 (P2)**: accounting sync, real-time feeds, mobile apps.

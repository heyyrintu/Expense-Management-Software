# PROMPTS.md — Claude Code session prompts (Milestones 6–8)

One prompt = one session. Paste as-is. Each assumes CLAUDE.md, PLAN.md, and the skills in `.claude/skills/` exist in the repo.

---

## 6.1 Reimbursement upgrade + payment proof

```
Read CLAUDE.md, PLAN.md, and PRD 6.6, then do task 6.1 — Reimbursement upgrade + payment proof.
Invoke add-feature-module, db-migration, and ui-screen skills.

Schema: employee bank details on User (masked display); PaymentBatch (org_id, created_by,
paid_at, method, notes); extend Reimbursement with method, reference/UTR, batch_id?,
amount_paid, proof_file_url?. RLS on new tables.

Build:
1. Employee profile: add/edit bank details, account number masked after save.
2. Finance queue: single or batch reimburse — pick approved reports, method
   (bank_transfer/upi/cash/payroll), per-report reference/UTR, payment-proof upload
   (JPG/PNG/PDF ≤10 MB) stored under /{orgId}/payment-proofs/ with signed URLs.
3. Partial reimbursement: amount_paid < total → new PartiallyReimbursed state with
   balance shown; extend lib/domain/report-workflow.ts; full payment → Reimbursed.
4. Employee view: method, reference, date, proof preview per report.
5. AuditLog on every payment action.

Tests: unit — balance math + transitions; isolation — org B cannot see org A batches,
bank details, or proof URLs.
DoD per CLAUDE.md; check off 6.1; commit "feat: 6.1 reimbursement upgrade".
```

## 6.2 Cash advances & trip pre-approval

```
Read CLAUDE.md, PLAN.md task 6.2, then do task 6.2 — Cash advances & trip pre-approval.
Invoke add-feature-module, db-migration, and ui-screen skills.

Schema: Advance (org_id, user_id, amount, purpose, trip_start?, trip_end?, status,
approved_by?, disbursed_at?, disbursement_ref?, settled_amount). RLS + org_id indexes.

Build:
1. Employee: request advance (amount, purpose, optional trip dates); states
   Draft → Submitted → Approved/Rejected → Disbursed → Settled/PartiallySettled.
   Reuse approval routing from reports (assigned approver, self-approval blocked).
2. Finance: disburse approved advances (reference + optional payment proof, reuse 6.1
   upload); advance register with filters and outstanding totals.
3. Settlement: when a report is reimbursed, offer to offset against the user's open
   advances (oldest first); track settled_amount; refund-due-to-org shown when advance
   exceeds claims. Pure settlement math in lib/domain/advance.ts.
4. Employee dashboard shows open advance balance. AuditLog every transition.

Tests: unit — settlement/offset math incl. partial; isolation — cross-org advance access.
DoD; check off 6.2; commit "feat: 6.2 cash advances".
```

## 6.3 Billable & split expenses

```
Read CLAUDE.md, PLAN.md task 6.3, then do task 6.3 — Billable & split expenses.
Invoke add-feature-module, db-migration, and ui-screen skills.

Schema: Expense gains billable (bool), client_id?, tax_amount?, tax_number?;
Client (org_id, name, code); ExpenseSplit (expense_id, category_id, project_id?,
amount) — splits must sum exactly to expense amount (integer minor units, no rounding
loss: last split absorbs remainder).

Build:
1. Clients CRUD (finance_admin), org-scoped.
2. Expense form: billable toggle → client picker; optional tax amount + tax/GST number.
3. Split UI: split by amount or % across categories/projects; live validation that
   splits total the expense; policy engine (lib/domain/policy.ts) evaluates each split
   against its category limits.
4. Reports/dashboards: billable spend by client and project; CSV export.

Tests: unit — split sum invariant incl. remainder handling, policy-per-split;
isolation — clients and splits org-scoped.
DoD; check off 6.3; commit "feat: 6.3 billable and split expenses".
```

## 6.4 Multi-currency

```
Read CLAUDE.md, PLAN.md task 6.4, then do task 6.4 — Multi-currency.
Invoke add-feature-module and db-migration skills.

Schema: Expense gains currency (ISO 4217), fx_rate (decimal string), base_amount (Int,
minor units of org currency); amount stays in original currency minor units.

Build:
1. Expense form: currency picker (org base preselected); when foreign, require fx_rate —
   prefilled from lib/fx/ rate provider (interface + stub returning fixed test rates +
   manual override field); base_amount = amount × rate, computed in lib/money.ts
   (banker's rounding, documented).
2. All totals, limits, budgets, reports, and the 7.x ledger use base_amount; original
   currency shown alongside (e.g., "$120.00 → ₹10,032").
3. Policy engine compares base_amount against limits.
4. Backfill migration: existing expenses get currency=org base, rate=1, base_amount=amount.

Tests: unit — conversion + rounding edge cases; report totals mixing currencies.
DoD; check off 6.4; commit "feat: 6.4 multi-currency".
```

## 6.5 Recurring & delegate

```
Read CLAUDE.md, PLAN.md task 6.5, then do task 6.5 — Recurring expenses & delegate access.
Invoke add-feature-module, db-migration, and ui-screen skills.

Schema: RecurringTemplate (org_id, user_id, cadence[monthly|weekly], day, amount,
category_id, merchant, purpose, active, last_run_at); Delegation (org_id, delegate_id,
principal_id, active) — unique pair, no self-delegation.

Build:
1. Recurring: employee creates template; a scheduled job (route handler /api/cron/recurring,
   secured by CRON_SECRET, documented for external cron) drafts the expense on schedule;
   duplicate-safe via last_run_at; drafted expenses flagged "auto-created — review".
2. Delegate: org_admin assigns delegate → principal; delegate sees an "Acting as X" switcher;
   while acting, expenses/reports are created under the principal with BOTH identities in
   AuditLog (actor_id = delegate, on_behalf_of = principal); delegates cannot approve as
   principal.

Tests: unit — cadence math, no double-draft; isolation — delegation pairs org-scoped;
authz — delegate cannot act for a principal in another org or approve as them.
DoD; check off 6.5; commit "feat: 6.5 recurring and delegate".
```

## 6.6 Email receipt ingestion

```
Read CLAUDE.md, PLAN.md task 6.6, then do task 6.6 — Email receipt ingestion.
Invoke add-feature-module skill.

Build:
1. lib/inbound-email/ provider interface (parse webhook → {from, to, subject, attachments});
   implement for one provider (Mailgun or SES SNS — pick one, document env vars); route
   handler /api/webhooks/inbound-email with signature verification.
2. Address scheme receipts+{orgslug}@APP_MAIL_DOMAIN; sender matched to user by verified
   email within that org; unknown sender → reject silently + log.
3. Each PDF/image attachment (≤10 MB) → org receipt storage → OCR autofill → Draft expense;
   email subject becomes purpose if parseable; multiple attachments = multiple expenses.
4. In-app notification: "N expenses created from your email"; failures land in a dead-letter
   list visible to org_admin.

Tests: unit — address parsing, sender matching; isolation — attachment from org A sender
can never create records in org B; webhook signature rejected when invalid.
DoD; check off 6.6; commit "feat: 6.6 email receipt ingestion".
```

## 6.7 Analytics upgrade

```
Read CLAUDE.md, PLAN.md task 6.7, then do task 6.7 — Analytics upgrade.
Invoke add-feature-module and ui-screen skills.

Build (finance dashboard, all org-scoped, Recharts):
1. Spend trend: monthly line/area by category/department/project, 12-month window.
2. Policy-violation leaderboard: violations by type and by user; drill-down to expenses.
3. Approval bottlenecks: avg + p90 time per approver, oldest pending reports.
4. Budget vs actual (if budgets built): utilization bars with drill-down.
5. Scheduled monthly summary: /api/cron/monthly-summary (CRON_SECRET) emails finance a
   CSV + key numbers; store last-run status.
All widgets must reconcile exactly with filtered table views (shared query layer, one
lib/analytics/ module — no duplicated SQL).

Tests: unit — analytics aggregations against seeded fixtures; isolation — org-scoped.
DoD; check off 6.7; commit "feat: 6.7 analytics upgrade".
```

---

## 7.1 Reimbursement ledger (Tally-style)

```
Read CLAUDE.md, PLAN.md task 7.1, then do task 7.1 — Reimbursement ledger.
Invoke add-feature-module and ui-screen skills. Requires 6.1 (and 6.2 if built).

Build:
1. lib/domain/ledger.ts — DERIVED view (no stored ledger table): per-user dated lines —
   credits: approved report totals (and advance settlements); debits: payments (with
   UTR/batch) and disbursed advances; running balance; header totals: requested /
   approved / paid / outstanding. Deterministic ordering (date, then id).
2. Screens: employee "My Ledger"; finance ledgers for any user + rollups per project and
   department; filters (entity, date range); print-friendly.
3. Exports: CSV; Tally XML vouchers (Receipt/Payment voucher per line; org-configurable
   ledger-name mapping in settings) — validate XML against Tally import format.
4. Reconciliation invariant: ledger outstanding must equal (approved − paid) from the
   source tables — add an automated consistency test.

Tests: unit — running balance, partial payments, advance offsets, ordering; consistency
invariant; isolation — cross-org ledger access blocked.
DoD; check off 7.1; commit "feat: 7.1 ledger".
```

## 7.2 Bank statement reconciliation

```
Read CLAUDE.md, PLAN.md task 7.2, then do task 7.2 — Bank statement reconciliation.
Invoke add-feature-module, db-migration, and ui-screen skills. Requires 6.1.

Schema: BankStatementImport (org_id, filename, column_mapping json, period_start/end,
locked_at?, imported_by); BankStatementLine (import_id, date, amount, reference,
matched_reimbursement_id?, match_type[auto|manual]). RLS.

Build:
1. Upload CSV/XLSX → column-mapping step (pick date/amount/reference columns, preview 5
   rows, save mapping per org for reuse); robust date parsing (dd/mm/yyyy priority).
2. Auto-match in lib/domain/reconcile.ts: pass 1 UTR/reference exact; pass 2 amount +
   date ±3 days (unambiguous only); never double-match.
3. Review UI, three buckets: Matched; In-app-not-in-bank (red flag list); In-bank-not-
   in-app with one-click "record payment" (creates Reimbursement, flows into 7.1 ledger).
   Manual match/unmatch with search.
4. Summary: period, matched %, unexplained amount; Lock period (blocks edits to matched
   records' payment fields); AuditLog imports, matches, locks.

Tests: unit — matcher passes, ambiguity handling, no double-match; isolation — imports
org-scoped.
DoD; check off 7.2; commit "feat: 7.2 bank reconciliation".
```

## 7.3 Complaints

```
Read CLAUDE.md, PLAN.md task 7.3, then do task 7.3 — Complaints (expense-linked disputes).
Invoke add-feature-module, db-migration, and ui-screen skills.

Schema: Complaint (org_id, raised_by, report_id?|reimbursement_id? — exactly one set,
type[wrong_amount|unfair_rejection|payment_not_received|other], description, status
[Open|InReview|Resolved|WontFix], assigned_to?, resolution_note?, resolved_at?);
ComplaintMessage (complaint_id, author_id, body, created_at). RLS.

Build:
1. Employee: "Raise complaint" on report/payment pages — type, description, optional
   attachment; payment_not_received auto-links the 6.1 payment proof.
2. Routing: to finance_admin pool (assignable); NEVER auto-assigned to the approver whose
   decision is disputed — enforce in code.
3. Finance: complaints inbox with status/type/age filters; 5-business-day SLA badge
   (green/amber/red); threaded messages; resolve requires resolution_note.
4. Employee notified (in-app + email stub) on every status change; dashboard widget:
   open complaints + aging.
5. AuditLog all transitions; complaints immutable after Resolved except thread.

Tests: unit — SLA calc (business days), routing exclusion rule; isolation — org-scoped.
DoD; check off 7.3; commit "feat: 7.3 complaints".
```

---

## 8.1 WhatsApp channel infra + number linking

```
Read CLAUDE.md, PLAN.md task 8.1, then do task 8.1 — WhatsApp infra + number linking.
Invoke add-feature-module and db-migration skills.

Build:
1. lib/whatsapp/ provider interface: sendText, sendTemplate, sendMedia, downloadMedia,
   verifyWebhook. Implement MetaCloudProvider (Graph API); document env vars
   (WA_PHONE_NUMBER_ID, WA_TOKEN, WA_VERIFY_TOKEN, WA_APP_SECRET). Design so a Twilio
   provider could replace it. Entire feature env-gated: absent config = feature hidden,
   app fully functional.
2. Org settings: WhatsApp enable toggle + credentials (encrypted at rest).
3. User linking: profile page → enter number → OTP sent via WhatsApp → verified number
   stored (unique per org, org-scoped). Unlink option.
4. Webhook /api/webhooks/whatsapp: GET verify handshake; POST with X-Hub-Signature-256
   validation; inbound messages persisted to WhatsAppInbound (org resolution via number
   lookup) for 8.2 to consume; unknown numbers get a canned "not linked" reply,
   rate-limited.

Tests: unit — signature verification, OTP flow, number normalization (+91 handling);
isolation — same number linkable in two orgs maps to correct org by business-number
routing.
DoD; check off 8.1; commit "feat: 8.1 whatsapp infra".
```

## 8.2 Receipt-to-expense over WhatsApp

```
Read CLAUDE.md, PLAN.md task 8.2, then do task 8.2 — Receipt-to-expense over WhatsApp.
Invoke add-feature-module skill. Requires 8.1.

Build:
1. Inbound image/PDF from a linked number → downloadMedia → org receipt storage →
   OCR autofill → Draft expense for that user.
2. Bot reply with parsed summary ("Merchant X, ₹450, 12 Aug — correct?") + interactive
   buttons: Confirm (keeps draft), Edit (deep link to expense in app), Discard (deletes
   draft + receipt). Button callbacks handled in the webhook, idempotent.
3. Text-only "lunch 450" style: parse trailing/leading amount → draft expense with text
   as purpose; unparseable text → help reply listing what I can do.
4. Per-number rate limit; media >10 MB politely refused; every action AuditLogged with
   channel=whatsapp.

Tests: unit — text parser (amounts, ₹/Rs prefixes, decimals), idempotent callbacks;
isolation — media and drafts land in the sender's org only.
DoD; check off 8.2; commit "feat: 8.2 whatsapp receipt capture".
```

## 8.3 WhatsApp notifications & quick approve

```
Read CLAUDE.md, PLAN.md task 8.3, then do task 8.3 — WhatsApp notifications & quick approve.
Invoke add-feature-module skill. Requires 8.1; integrates with notification events from 2.3.

Build:
1. Template registry lib/whatsapp/templates.ts mapping events → approved template names +
   params: report_submitted (→approver), report_approved / rejected / sent_back (→employee),
   payment_done with amount+UTR (→employee), complaint_status (→employee). Respect 24-hour
   session rules: free-form only inside session window, else template. Per-user opt-out
   toggle; fall back to existing email/in-app when WhatsApp disabled or opted out.
2. Quick approve: approver's report_submitted message has buttons Approve / Open in app.
   Approve callback → same requireRole + report-workflow path as web (self-approval blocked,
   policy-flagged reports CANNOT be approved via WhatsApp — button replaced by Open in app).
   Reject always goes to the app (reason mandatory).
3. Confirmation replies after actions; AuditLog with channel=whatsapp.
4. Ops: outbound send failures logged with retry (max 3, backoff); delivery status webhook
   stored.

Tests: unit — event→template mapping, flagged-report guard, idempotent approve callback;
authz — callback from a number not linked to the approver is rejected.
DoD; check off 8.3; commit "feat: 8.3 whatsapp notifications".
```

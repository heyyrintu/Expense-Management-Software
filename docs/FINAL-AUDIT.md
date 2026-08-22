# FINAL-AUDIT.md — Pre-release verification

**Date:** 2026-08-22 · **Scope:** feature completeness (PLAN.md M0–M8), design conformance (DESIGN-PLAN.md D0–D5), Sage Expense Management parity, industry-standard readiness.
**Method:** static audit of the actual codebase (not checkbox review) + execution of all four design lint checkers.

---

## Verdict

**Build quality is high and genuinely implemented** — not a checkbox farm. 32 Prisma models with RLS on every tenant table, ~590 unit + 183 isolation assertions, one commit per plan task, zero TODO/FIXME in `app/`, `lib/`, `components/`, and `tsc --noEmit` clean.

**But the project is not releasable yet.** Three design tasks (D5.3, D5.4, D5.5) are ticked in the plan while their own audit documents state the work never ran — no Lighthouse, no axe execution, no screenshots, no keyboard or screen-reader pass. Plus six functional gaps, one of which (CSV export unreachable) is user-visible.

**Release status: BLOCKED on 9 items.** See the punch list at the end. None are architectural; all are hours, not days.

---

## 1. Gates executed

| Gate | Result |
|---|---|
| `check-design-tokens.mjs` | ✅ no raw hex or arbitrary values in `app/**`, `components/**`, `lib/**` |
| `check-copy-voice.mjs` | ✅ no apologies, exclamations, or blame in user-facing copy |
| `check-motion.mjs` | ✅ no `transition-all`, `ease-in-out`, layout transitions, or over-ceiling durations |
| `check-contrast.mjs` | ✅ 56 token pairs meet WCAG 2.1 AA |
| `tsc --noEmit` | ✅ clean |
| `npm run test` / `test:isolation` | ⚠️ **not executed** — `node_modules` holds Windows-native rolldown bindings; must be run on the Windows host |
| `npm run test:e2e` / `test:a11y` / `screenshots` | ❌ **never run** (see D5 findings) |
| Lighthouse | ❌ **never run** |

---

## 2. Feature coverage vs PLAN.md

**33 of 39 tasks fully implemented and verified in code.** Highlights confirmed present: per-transaction RLS via `set_config('app.current_org_id')` with a coverage test asserting every `org_id` table has an enabled+forced policy; real Tesseract OCR with a 20s race that never throws; timing-safe WhatsApp HMAC verification; AES-256-GCM credential storage; a real Tally XML voucher writer; derived-not-stored ledger enforcing `outstanding = approved − paid`.

### Gaps found

| ID | Task | Gap | Severity |
|---|---|---|---|
| **G1** | 4.2 | **CSV export route has zero callers.** `app/api/exports/expenses/route.ts` is fully implemented (scope-pinned, Excel-injection-safe) but no button or link anywhere reaches it. Ledger export *is* wired; this one was likely orphaned during the D1–D5 rework. | **High** — advertised feature is unreachable |
| **G2** | 7.3 | **Complaints dashboard widget on the wrong page.** `complaintSummary()` is documented as the dashboard widget but its only consumer is the complaints page. `dashboard/page.tsx` never mentions complaints. | Medium |
| **G3** | 6.7 | **Monthly summary ships CSV only** — pasted into the email body, no attachment, no PDF anywhere in the repo. Plan said "PDF/CSV". | Low |
| **G4** | 4.3 | **Playwright e2e never runs in CI.** Workflow covers lint/build/unit/migrate/isolation only; `test:e2e`, `test:a11y`, `screenshots` exist but no workflow invokes them. | Medium — happy path can rot silently |
| **G5** | — | `scripts/check-rls-state.mjs` is orphaned (not in `package.json`, CI, or tests). Low risk: `tests/isolation/rls.test.ts` independently asserts coverage. | Low |
| **G6** | 6.4 | **FX stub is one-directional** — `stubRates` maps only `X → INR`, so a non-INR tenant gets no prefill. Manual override always available; a stated stub, so a limitation rather than a miss. | Low |

**Non-findings worth recording:** RLS complete across all 32 tables (only `organizations` and `super_admins` lack policies, correctly — they are org-less by design). The only stubs are the two PLAN.md explicitly requested (console email transport, FX rates).

---

## 3. Design conformance vs DESIGN-PLAN.md

**D0–D4: substantively implemented.** Zero raw hex, zero arbitrary values, 22-section design-system gallery with access gating, real motion inventory (21 animations catalogued with duration/easing/verdict), and `lib/motion.ts` that records *deletions with reasons* — evidence of a real audit rather than a rubber stamp.

Recorded wins: dashboard First Load JS **342 → 229 kB** (−33%), analytics **237 → 119 kB** (−50%) via lazy-loaded Recharts. Contrast fixes: `--fg-tertiary` **2.56 → 5.28:1**, `--line-strong` **1.48 → 3.42:1**, `--status-warning` **2.90 → 3.21:1**.

### Gaps found

| ID | Check | Gap | Severity |
|---|---|---|---|
| **D-1** | Status colour discipline | **51 Tailwind palette classes across 12 feature files** bypass the token layer — and several bypass `StatusBadge` itself. `settings/users/page.tsx:31-33` hand-maps user status to `bg-green-100`/`bg-blue-100`/`bg-gray-200` though all four states exist in `STATUS_MAP`. Same in `budgets-panel.tsx`, `analytics/page.tsx`, `decision-panel.tsx`, `whatsapp/settings-form.tsx`, all of `app/super/**`. **The lint is green because `TOKEN_ONLY_DIRS` covers only 4 paths** — its own comment says D1–D5 should have added each screen directory as it landed; that never happened. | **High** — the one rule DESIGN-PRD calls single-source-of-truth is violated |
| **D-2** | D5.3 Accessibility | **Ticked but never executed.** `A11Y-AUDIT.md:165` states plainly: *"the axe suite has not been executed… the suite is therefore unproven."* No keyboard walkthrough, no screen-reader pass, Lighthouse a11y unmeasured. The harness (20 routes + 2 overlays, WCAG 2.1 A+AA) is written and typechecks. | **Blocker** |
| **D-3** | D5.4 Performance | **Ticked but never executed.** `PERF-AUDIT.md:19`: *"Lighthouse — **not run**… **none of those numbers exist**."* CLS and INP targets unverified. Bundle numbers are real; the browser metrics are not. | **Blocker** |
| **D-4** | D5.5 Design QA | **Screenshot baseline never captured** — `docs/screenshots/` contains only a README. No visual regression baseline exists. | Medium |
| **D-5** | Token integrity | **`--color-accent` is declared twice** in `globals.css` (`:187` → indigo `#6366f1`, `:512` → leftover shadcn `oklch(0.97 0 0)`). Tailwind v4 merges `@theme` last-wins, so **`bg-accent` currently resolves to near-white, not indigo.** No live breakage (0 bare `bg-accent` usages) but the most natural class name is silently wrong, and this exact class of error already bit once per `A11Y-AUDIT.md` finding #6. | **High** — latent trap |
| **D-6** | Focus visibility | **`components/shell/command-palette.tsx:124`** — search input has `outline-none` with no `focus-within` ring on its parent. WCAG 2.4.7 miss; masked by `autoFocus`, but tabbing back shows nothing. 33 of 38 other `outline-none` sites are correctly paired. | Medium |
| **D-7** | Formatting discipline | **`stat-card.tsx:84`** calls `toLocaleString("en-IN")` directly — hard-codes Indian locale inside a design-system primitive. D1.1's own DoD said to grep these out; the grep missed StatCard. | Low |
| **D-8** | Doc drift | Token names were renamed during build (`--text-*`→`--fg-*`, `--success`→`--status-success`, `--border`→`--line`) without updating DESIGN-PRD §5, so the PRD no longer reads as ground truth. | Low |
| **D-9** | Dead code | Full `[data-theme=dark]` palette exists (~30 lines) though dark mode is an explicit non-goal, plus a dead shadcn `:root` block. 5 dark status tokens are unverified by the contrast checker. | Low |

**Environmental note:** `DESIGN-QA.md` attributes the unrun verifications to a host that can't complete `next build` (`STATUS_STACK_BUFFER_OVERRUN`) or start a dev server (`RangeError: Array buffer allocation failed`). Credible, and honestly disclosed in three separate documents — but the plan checkboxes don't reflect it.

---

## 4. Sage Expense Management parity

| Sage feature | Ours | Notes |
|---|---|---|
| Receipt capture (photo/upload) | ✅ | `ReceiptDropzone`, per-org S3 prefixes, signed URLs |
| OCR auto-extraction | ✅ | Real Tesseract, never blocks on failure |
| Text-to-Expense (SMS/conversational AI) | ✅ **via WhatsApp** | M8: OTP linking, photo→draft, quick-approve buttons. Better fit for India than SMS |
| Email forwarding for e-receipts | ✅ | 6.6, per-org inbound address, HMAC-verified, dead-letter queue |
| Gmail/Outlook one-click plugins | ❌ | Not built — browser-extension work, out of scope |
| Expense tracking | ✅ | Full CRUD, categories, projects, clients, splits, tax fields |
| Mileage tracking | ✅ | Distance × org rate |
| **Per-diem** | ✅ | Built 2026-08-23. Finance-configurable rates VERSIONED by effective date, half-day travel-day rule, receipt rule explicitly exempted (`lib/domain/policy.ts`) |
| Expense approvals + custom routing | ✅ | 2.2 + 5.4 chains, self-approval blocked, 2nd-level thresholds |
| Policy engine (overages, duplicates, violations) | ✅ | 3.1: per-expense + monthly limits, receipt threshold, age, duplicates. Flags never block |
| Reimbursements | ✅ tracking / ❌ execution | Full workflow + proof + batch + partial. ACH execution is an explicit non-goal (regulated) |
| Budgets + alerts | ✅ | 5.1, 80%/100% thresholds |
| Real-time reporting / dashboards | ✅ | 3 role variants, one where-clause feeding KPIs and charts |
| Card reconciliation (statement) | ✅ | 5.2 CSV import + amount/date matching |
| Real-time card feeds (Visa/MC) | ❌ | Needs bank partnerships — explicit non-goal |
| Virtual cards | ❌ | Explicit non-goal |
| Accounting integrations (Intacct, QBO, NetSuite, Xero) | ⚠️ **export only** | CSV + **Tally XML**. Direct two-way sync is P2 — the largest remaining gap vs Sage |
| Native mobile app | ⚠️ responsive web | Explicit non-goal; capture flow is mobile-first |
| AI copilot (natural-language spend) | ❌ | P2 |
| Multi-entity / multi-org | ✅ | True multi-tenant with RLS — arguably stronger than Sage's |
| SOC 2 / GDPR / PCI posture | ⚠️ | Architecture supports it (RLS, append-only audit, per-org storage, encrypted creds). Certification is an org process, not code |

**Features we have that Sage does not:** Tally-style party ledger with running balance, bank-statement reconciliation for *payments* (Sage reconciles card spend only), complaints/dispute workflow with SLA, cash advances with settlement, delegate submission, and WhatsApp as a first-class channel.

**Parity verdict:** ~85% of Sage's advertised surface, with the deliberate omissions being the three that require external partnerships (card feeds, virtual cards, ACH) plus native apps. The one unintentional miss is **per-diem**. The one strategically significant gap is **direct accounting sync** — CSV/Tally export covers Indian SMBs but not a QuickBooks/NetSuite shop.

---

## 5. Industry-standard assessment

| Dimension | Standard | Ours |
|---|---|---|
| Tenant isolation | App-layer scoping | **Exceeds** — RLS enabled *and* forced per transaction, plus a coverage test and 183 isolation assertions |
| Audit trail | Append-only log | **Meets** — every state change, actor + channel recorded |
| Money handling | Integer minor units | **Meets** — no floats, `<Amount>` used in 48 files |
| Authorization | Server-side guards | **Meets** — `requireRole` on actions; UI hiding never treated as authorization |
| Secrets | Encrypted at rest | **Meets** — AES-256-GCM |
| Accessibility | WCAG 2.1 AA | **Unproven** — harness exists, never run (D-2) |
| Performance | Lighthouse ≥90 | **Unproven** — bundle work real, browser metrics never measured (D-3) |
| CI | Lint + test + build gated | **Partial** — e2e/a11y excluded (G4) |
| Design system | Single source of truth | **Partial** — enforced in primitives, bypassed in 12 feature screens (D-1) |

---

## 6. Release punch list

**Blockers — do before calling it done**

1. **Run the verification suite on the Windows host**: `npm run test`, `npm run test:isolation`, `npm run test:e2e`, `npm run test:a11y`, and Lighthouse on `/dashboard`, `/expenses`, `/expenses/new`. Fix what surfaces. Until this runs, D5.3/D5.4 are unticked. *(D-2, D-3)*
2. **Fix the duplicate `--color-accent`** in `globals.css` — delete the dead shadcn block at `:452-473`/`:495-518` so `bg-accent` resolves to indigo. *(D-5)*
3. **Add the 12 feature-screen directories to `TOKEN_ONLY_DIRS`** and clear the 51 palette classes — several are status colours that must route through `StatusBadge`. *(D-1)*
4. **Wire the CSV export** into the expenses screen — the route already works. *(G1)*

**Should fix**

5. Add a `focus-within` ring to the command-palette input. *(D-6)*
6. Add `test:e2e` and `test:a11y` to the CI workflow. *(G4)*
7. Capture the screenshot baseline (`npm run screenshots`). *(D-4)*
8. Move the complaints summary widget onto the dashboard. *(G2)*
9. Route `stat-card.tsx:84` through the shared formatter. *(D-7)*

**Backlog**

10. ~~Per-diem expense type~~ — **done 2026-08-23**. Schema + migration (RLS, org_id-leading indexes), finance settings screen, capture variant, policy exemption; 30 unit + 13 isolation assertions. The migration is UNAPPLIED — run `npx prisma migrate deploy` and `npx prisma generate` on the host.
11. Direct accounting sync (QBO/Xero/NetSuite) — the strategic gap.
12. Monthly summary as PDF attachment. *(G3)*
13. Sync DESIGN-PRD §5 token names to the implemented names. *(D-8)*
14. Delete dead dark-theme and shadcn blocks, or bring dark tokens under contrast checking. *(D-9)*
15. Make FX stub bidirectional for non-INR tenants. *(G6)*
16. Remove or wire `scripts/check-rls-state.mjs`. *(G5)*

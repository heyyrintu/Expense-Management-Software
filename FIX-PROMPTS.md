# FIX-PROMPTS.md — Claude Code prompts for remaining work

Derived from `docs/FINAL-AUDIT.md`. Six sessions, in order. F1–F3 are release blockers; F4–F6 are backlog.

Run F1 → F2 → F3 before calling the product done. F3 depends on F1/F2 being merged (it re-runs every gate).

---

## F1 — Token integrity (blockers D-5, D-1)

```
Read docs/FINAL-AUDIT.md sections D-1 and D-5, plus CLAUDE.md and DESIGN-PRD.md §5.
Invoke the design-craft skill. This is presentation-only — no logic changes.

Fix two token-layer defects the design lint currently misses.

1. DUPLICATE ACCENT TOKEN
   app/globals.css declares --color-accent twice: around line 187 mapped to
   var(--accent-base) (#6366f1, correct) and again around line 512 mapped to
   var(--accent) (oklch(0.97 0 0) — leftover shadcn near-white). Tailwind v4 merges
   @theme blocks last-wins, so bg-accent currently resolves to near-white.
   - Delete the dead shadcn :root block (~lines 452-473) and the second @theme inline
     block (~lines 495-518) entirely, keeping any token that is genuinely referenced.
   - Verify with grep that nothing in app/**, components/**, lib/** referenced the
     deleted names; if something did, repoint it at the real token.
   - Confirm bg-accent / text-accent / border-accent now resolve to the indigo family.

2. PALETTE CLASSES LEAKING INTO FEATURE SCREENS
   scripts/check-design-tokens.mjs bans Tailwind palette classes (bg-green-100 etc.)
   but TOKEN_ONLY_DIRS covers only 4 paths, so 51 violations across 12 files pass lint.
   - Find every violation across app/** and components/** (bg-|text-|border-|ring-
     followed by a Tailwind colour name + numeric shade).
   - Replace each with the correct semantic token. CRITICAL: several are statuses being
     hand-coloured — app/(app)/settings/users/page.tsx lines ~31-33 maps user status to
     bg-green-100/bg-blue-100/bg-gray-200 although active/invited/deactivated/suspended
     all exist in lib/design/status.ts STATUS_MAP. Those must render through
     <StatusBadge>, not inline classes. Same pattern in budgets-panel.tsx,
     analytics/page.tsx, decision-panel.tsx, whatsapp/settings-form.tsx, card-import-panel.tsx,
     and everything under app/super/**.
   - Then widen TOKEN_ONLY_DIRS to cover all of app/** and components/** so this can
     never regress, and delete the stale comment about adding directories as D1-D5 land.

Verify: node scripts/check-design-tokens.mjs passes with the widened scope, all four lint
checkers pass, npm run lint && npm run build clean. Update /design-system if any component
changed. Commit "fix: token integrity — dedupe accent, clear palette classes".
```

---

## F2 — Wiring gaps and small fixes (G1, G2, D-6, D-7)

```
Read docs/FINAL-AUDIT.md gaps G1, G2, D-6, D-7. Invoke design-craft and ui-screen skills.

Four disconnected pieces — each is already built, just not reachable or not routed
through the shared component.

1. CSV EXPORT IS UNREACHABLE (G1)
   app/api/exports/expenses/route.ts is fully implemented (scope-pinned query,
   Excel-injection-safe buildCsv) but no UI calls it. Add an Export button to the
   expenses screen toolbar that hits the route with the CURRENT filter state — the
   export must return exactly the rows the table is showing, so serialise the same
   ExpenseFilters the page parsed from the URL. Follow the ledger export as the
   reference implementation (app/(app)/ledger/page.tsx). Secondary button, not primary.
   Add a test asserting the exported row count matches the filtered query count.

2. COMPLAINTS WIDGET IS ON THE WRONG PAGE (G2)
   lib/complaints/queries.ts complaintSummary() is documented as the finance dashboard
   widget but its only caller is the complaints page. Add it to the finance variant of
   app/(app)/dashboard/page.tsx: open complaint count + aging, finance-only, linking to
   /complaints with the matching filter. It must obey the dashboard rule in CLAUDE.md —
   the card's href is the same filter state serialised back out. If the count cannot be
   an expense sum, declare agreement: { kind: "different", note } per lib/domain/dashboard-kpi.ts.

3. COMMAND PALETTE FOCUS RING (D-6)
   components/shell/command-palette.tsx line ~124: the search input has outline-none and
   its parent (~line 113) has no focus-within ring. WCAG 2.4.7 miss, masked by autoFocus
   but visible when tabbing back. Add focus-within:ring-2 ring-focus-ring ring-offset-2
   to the container, matching the pattern used in input.tsx and amount-input.tsx.

4. STATCARD FORMATS ITS OWN NUMBERS (D-7)
   components/ui/stat-card.tsx line ~84 calls toLocaleString("en-IN") directly in the
   non-currency branch — a hard-coded locale inside a design-system primitive. Route it
   through the shared formatter in lib/. Leave the delta percentage and sparkline SVG
   coordinate maths alone; those are legitimately not money.

Verify: npm run lint && npm run build && npm run test && npm run test:isolation green.
Commit "fix: wire csv export, dashboard complaints widget, focus ring, statcard format".
```

---

## F3 — Run the verification suite (blockers D-2, D-3, D-4, G4)

```
Read docs/FINAL-AUDIT.md items D-2, D-3, D-4, G4, plus docs/A11Y-AUDIT.md and
docs/PERF-AUDIT.md — both state plainly that their browser-dependent checks never ran,
while DESIGN-PLAN.md ticks D5.3 and D5.4 anyway. Close that gap.

Run this on the Windows host where next build and a dev server actually work. If the
build still fails with STATUS_STACK_BUFFER_OVERRUN, fix that first — that blocker is
itself the task.

1. EXECUTE EVERY SUITE, RECORD REAL NUMBERS
   - npm run test and npm run test:isolation — confirm green (they have never been
     verified on a machine that can run them; node_modules holds Windows-native
     rolldown bindings).
   - npm run test:e2e — the signup → submit → approve → reimburse happy path.
   - npm run test:a11y — the axe suite over 20 routes + 2 overlays. Fix every violation
     it surfaces; the suite is currently unproven, so expect real findings.
   - Lighthouse on /dashboard, /expenses, /expenses/new: record Performance,
     Accessibility, CLS, and INP. Targets: perf ≥90, a11y ≥95, CLS <0.05, INP <200ms.
   - npm run screenshots — capture the visual baseline into docs/screenshots/ (currently
     contains only a README).

2. MANUAL PASSES A5.3 REQUIRED BUT NEVER HAPPENED
   - Keyboard walkthrough of the three critical flows (submit expense, approve report,
     mark reimbursed): full operability, logical focus order, visible ring everywhere,
     focus trapped and restored in dialogs and sheets, Esc closes overlays.
   - Screen-reader pass on the same flows: labels announced, errors via aria-live,
     status badges readable, tables have header scope, icon-only buttons named.

3. UPDATE THE DOCS TO MATCH REALITY
   - Replace the "not run" sections of PERF-AUDIT.md and A11Y-AUDIT.md with measured
     numbers and the fixes applied.
   - Only then tick D5.3, D5.4, D5.5 in DESIGN-PLAN.md. If a target is missed and not
     fixed this session, leave the box unticked and record the number.

4. STOP THIS REGRESSING (G4)
   Add test:e2e and test:a11y to .github/workflows/ci.yml after the isolation step, with
   Playwright browsers installed and the app built. They exist in package.json but no
   workflow invokes them, so the happy path can rot undetected.

Commit "test: execute a11y, e2e, perf verification and wire into CI".
```

---

## F4 — Per-diem expense type (backlog #10)

```
Read PRD-expense-management-system.md (per-diem is listed under P1 and was never built —
the only unintentional gap vs Sage Expense Management). Invoke add-feature-module,
db-migration, and ui-screen skills.

Schema: PerDiemRate (org_id, name, location?, daily_amount, effective_from, active) —
finance_admin configurable, org-scoped, RLS + org_id-leading indexes. Expense gains
type="per_diem" plus per_diem_rate_id, days (or start/end dates).

Build:
1. Finance settings screen for per-diem rates (CRUD, following the categories screen as
   the reference layout).
2. Per-diem expense variant in the capture flow, matching how mileage already works
   (app/(app)/expenses/mileage-form.tsx): user picks a rate and a date range or day
   count, amount computes read-only as rate × days, integer minor units via lib/money.ts.
   Half-day handling: decide and document one rule — do not leave it implicit.
3. Policy engine treats per-diem like any other expense for limits and duplicate
   detection, but skips the receipt-required rule (there is no receipt for a per-diem).
   Make that exemption explicit in lib/domain/policy.ts with a comment, not implicit.
4. Ledger, dashboards, exports, and reports include per-diem with no special-casing.

Tests: unit — amount computation incl. the half-day rule and rate-effective-date
selection; policy receipt exemption; isolation — rates and per-diem expenses org-scoped.
DoD per CLAUDE.md; add to /design-system; commit "feat: per-diem expense type".
```

---

## F5 — Accounting integration export layer (backlog #11)

```
Read docs/FINAL-AUDIT.md section 4 — direct accounting sync is the largest remaining gap
vs Sage (they sync two-way with Intacct, QuickBooks, NetSuite, Xero; we export CSV and
Tally XML only). Full two-way sync is out of scope for one session. Build the layer that
makes it possible, and ship one real one-way export.

Invoke add-feature-module and db-migration skills.

1. MAPPING LAYER
   Schema: AccountingMapping (org_id, target[quickbooks|xero|netsuite|tally|generic],
   entity_type[category|department|project|user|tax], local_id, remote_code, remote_name).
   Finance settings screen to maintain it, with an "unmapped" warning list — an export
   must never silently drop a row because its category has no GL code.

2. EXPORT ADAPTERS
   lib/exports/accounting/ with one interface (buildExport(reports, mapping) -> file) and
   implementations: the existing Tally XML writer moved behind it, plus a QuickBooks
   Online-compatible journal-entry CSV (documented column spec, IIF not required).
   Adapters are pure functions over already-fetched data — no network calls, no partial
   writes.

3. EXPORT RUN TRACKING
   Schema: AccountingExport (org_id, target, period_start/end, report_ids, exported_at,
   exported_by, file_key). Prevent double-export of the same report without an explicit
   "re-export" confirmation, and show each report's export status on its detail page.

4. UI: finance export screen — pick target, period, and reports; show the unmapped
   warning; preview the line count and total before generating; download the file.

Design the interface so a future API-based two-way adapter drops in without reshaping the
schema. Do not build OAuth or live API calls in this session.

Tests: unit — mapping resolution, unmapped detection, adapter output shape, double-export
guard; isolation — mappings and export records org-scoped.
DoD; commit "feat: accounting export layer with quickbooks csv adapter".
```

---

## F6 — Cleanup batch (G3, G5, G6, D-8, D-9)

```
Read docs/FINAL-AUDIT.md backlog items 12-16. Five small independent cleanups; do them
all in one session.

1. MONTHLY SUMMARY PDF (G3)
   app/api/cron/monthly-summary/route.ts line ~79 pastes CSV into the email body. PLAN 6.7
   said "PDF/CSV". Generate a one-page PDF summary (headline numbers + category
   breakdown, using the print token overrides already in app/globals.css) and attach both
   PDF and CSV. If PDF generation adds a heavy dependency, say so and attach the CSV as a
   real file attachment instead — but decide explicitly rather than leaving it half-done.

2. ORPHANED RLS SCRIPT (G5)
   scripts/check-rls-state.mjs is referenced by nothing — not package.json, CI, or tests.
   Either wire it into npm run lint (if it adds coverage beyond
   tests/isolation/rls.test.ts) or delete it. Do not leave a third source of truth for
   tenant isolation lying around.

3. BIDIRECTIONAL FX STUB (G6)
   lib/fx/index.ts stubRates maps only X → INR, so getFxRate("INR","USD") returns null and
   a non-INR tenant gets no prefill. Make the stub resolve any pair via inversion and
   cross-rate through a base, keeping it clearly a stub. Manual override stays available.
   Unit-test inversion and cross-rate.

4. TOKEN NAME DRIFT (D-8)
   Token names were renamed during the build (--text-* → --fg-*, --success →
   --status-success, --border → --line) without updating DESIGN-PRD.md §5, so the PRD no
   longer reads as ground truth. Update §5 (and §5.2's map) to the implemented names.
   Docs follow code here — do not rename the code.

5. DEAD DARK-THEME BLOCK (D-9)
   app/globals.css lines ~139-170 define a full [data-theme=dark] palette although dark
   mode is an explicit non-goal in DESIGN-PRD §3, and .dark is never applied. Five of its
   status tokens are unverified by check-contrast.mjs. Either delete the block or bring it
   under the contrast checker — inert unverified tokens are how --fg-tertiary shipped at
   2.56:1 for five milestones. Recommend deleting; note the decision in DESIGN-PRD §3.

Verify: all four lint checkers, npm run lint && npm run build && npm run test &&
npm run test:isolation green. Commit "chore: cleanup — pdf summary, fx stub, token docs,
dead theme block".
```

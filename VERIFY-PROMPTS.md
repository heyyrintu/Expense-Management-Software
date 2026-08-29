# VERIFY-PROMPTS.md — Final two sessions

State as of 2026-08-23: `npx prisma generate` done, `tsc --noEmit` **clean (0 errors)**, all four design checkers pass, 727 unit tests, 223 isolation assertions written.

**New blocker found 2026-08-23: the migration history cannot replay from scratch.** Run V0 first — nothing else matters until it's fixed.

---

## V0 — Fix the out-of-order migration (BLOCKER)

```
The migration history is broken and cannot be replayed on an empty database. Fix it
before anything else. Do not work around it by pushing schema directly.

DIAGNOSIS (already confirmed — verify, don't re-derive):
`npx prisma migrate dev` fails with:
  P3006 Migration `20260819044600_dep` failed to apply cleanly to the shadow database.
  P1014 The underlying table for model `complaints` does not exist.

prisma/migrations/20260819044600_dep/migration.sql is timestamped 2026-08-19 04:46 but
depends on objects created by LATER migrations:
  - it drops and re-adds FK constraints on "complaints" — that table is created in
    20260820200000_complaints (Aug 20)
  - it drops index "whatsapp_inbound_org_id_expense_id_idx" — created in
    20260821140000_whatsapp_capture (Aug 21)

Prisma applies migrations in folder-name order, so on any fresh database this migration
runs before its dependencies exist. The current dev database only works because the
objects were created out of band. This would fail identically on a production deploy.

It also violates the CLAUDE.md rule "never edit an applied migration; additive first."

FIX:
1. Rename the folder so it sorts AFTER its dependencies — after
   20260821180000_whatsapp_notifications. Give it a meaningful name while you are there;
   "dep" says nothing. Suggested: 20260821190000_complaint_fk_and_whatsapp_index.
   Do NOT edit its SQL — the statements are correct, only the position is wrong.
2. Reconcile the existing database, which records the OLD folder name in
   _prisma_migrations. The datasource in .env points at a remote host
   (72.60.200.116:4785, database "postgres"). CONFIRM NOBODY ELSE IS USING THAT DATABASE
   before touching it, then either:
     a) `npx prisma migrate reset` followed by `npm run seed` — cleanest for a dev DB,
        destroys all data; or
     b) if the data must survive: UPDATE _prisma_migrations SET migration_name =
        '20260821190000_complaint_fk_and_whatsapp_index' WHERE migration_name =
        '20260819044600_dep', and confirm `npx prisma migrate status` reports no drift.
   Prefer (a). Also consider moving dev off a shared remote host onto the local
   docker-compose postgres, which is what docker-compose.yml already provides.
3. PROVE THE REPLAY. Create a throwaway empty database and run
   `npx prisma migrate deploy` against it end to end. It must complete with zero errors.
   This is the only real proof the history is sound — a passing `migrate dev` on an
   already-migrated database proves nothing.
4. Apply the two migrations that have never reached a database:
   20260823090000_per_diem and 20260823140000_accounting_export. The runtime error
   `column expenses.per_diem_rate_id does not exist` (P2022) on /expenses, /reports and
   /dashboard is this and nothing more — it clears once they apply.
5. Re-seed and confirm /expenses, /reports, /dashboard, /ledger and /complaints all load
   for both seed orgs.

THEN ASK WHY CI DIDN'T CATCH THIS:
.github/workflows/ci.yml line 65 runs `npx prisma migrate deploy` against a fresh
postgres:16-alpine service container — exactly the scenario that fails. So either CI has
been red since this migration landed, or it has not run. Find out which, and make the
answer visible: if the workflow is not running on every push, fix the trigger; if it has
been failing, say so in the commit.

Add a regression guard: a CI step (or an isolation test) that runs `migrate deploy`
against an empty database and fails the build if any migration references an object that
does not yet exist.

Verify: `npx prisma migrate deploy` clean on an empty DB, `npx prisma migrate status`
clean on dev, app loads with no P2022 errors in the dev server log.
Commit "fix: reorder out-of-order migration, apply per-diem and accounting migrations".
```

---

Then V1 (hygiene) and V2 (verification). V1 takes minutes and prevents V2 from re-committing a deleted file.

---

## V1 — Repo hygiene and doc drift (no build required)

```
Read docs/FINAL-AUDIT-ROUND2.md sections 4 and 6. Four small cleanups; none touch app code.

1. UNSTAGE THE RESURRECTED SCRIPT
   scripts/check-rls-state.mjs was deleted in HEAD (its coverage moved into
   tests/isolation/rls.test.ts:34 as a superuser-connection precondition), but the file is
   still on disk AND staged as an add — so the next commit brings it back. Commit ea0c34f
   notes the mount forbade deletion at the time.
   - Remove it from the index and from disk.
   - Confirm with `git status` that it is neither staged nor present.
   - Confirm nothing references it: grep package.json, .github/workflows/, and tests/.

2. RE-STAGE DELIBERATELY
   The index currently holds pre-F6 content while the worktree holds post-F6 — for example
   scripts/check-contrast.mjs: the index re-adds 30 lines that HEAD→index had removed.
   Run `git reset` to clear the index, review `git diff` in full, then stage and commit in
   coherent pieces. Uncommitted work also includes .github/workflows/ci.yml,
   DESIGN-PRD.md, and app/(app)/advances/advances-panel.tsx — check each is intended
   before committing. Do not blanket `git add -A`.

3. FIX THE LAST TOKEN-NAME DRIFT
   DESIGN-PRD.md §5 was rewritten to the real names in F6, but §6 was missed:
   - line 242 says `--border-strong` → should be `--line-strong`
   - line 266 says `--border` → should be `--line`
   Grep the whole file for any other pre-rename token name (--text-*, --success,
   --warning, --danger, --info, --border) outside the historical migration note at line 66,
   which quotes the old names deliberately and must stay as-is.

4. FIX THE A11Y COVERAGE CLAIM
   Three documents disagree about how many routes tests/e2e/a11y.spec.ts covers:
   docs/A11Y-AUDIT.md lines 105 and 236 say "20 routes plus 2 overlays", DESIGN-PLAN.md
   line 48 says "all 29 id-less routes", and the spec itself lists 2 public + 32
   authenticated + 2 overlays. Count what the spec ACTUALLY covers, make all three
   documents state that number, and if tests/unit/a11y-coverage.test.ts asserts a count,
   make it the same number.

Verify: npm run lint clean, npm run test green, `git status` clean apart from intended
work. Commit "chore: repo hygiene, token doc drift, a11y coverage count".
```

---

## V2 — Unblock the build and execute every verification

```
Read docs/VERIFICATION-RUNBOOK.md end to end, plus docs/A11Y-AUDIT.md and
docs/PERF-AUDIT.md. This is the last blocker: every browser-dependent check in D5.3-D5.5
is written but has never been executed, because `next build` dies with
STATUS_STACK_BUFFER_OVERRUN and `next dev` with RangeError: Array buffer allocation
failed. Fixing that is step 1 and the rest is gated on it.

STEP 1 — UNBLOCK THE TOOLCHAIN
The runbook's diagnosis: pnpm-workspace.yaml contains placeholder entries that literally
read "set this to true or false", and two lockfiles (package-lock.json + pnpm-lock.yaml)
have produced a hybrid npm+pnpm node_modules. Confirm or refute that diagnosis, then:
- Pick ONE package manager and delete the other lockfile.
- Delete node_modules entirely, reinstall clean (npm ci if npm), npx prisma generate.
- Run `npm run build`. If it still crashes, do not paper over it — bisect: try
  `next build --no-lint`, try with --max-old-space-size=8192, check for a Node version
  mismatch against .nvmrc/engines, and check whether a specific route crashes trace
  collection. Report the real cause.
Do not proceed until `npm run build` completes and `npm run dev` serves the app.

STEP 2 — RUN EVERY SUITE, RECORD REAL NUMBERS
- npx prisma migrate deploy (or migrate dev) — the two newest migrations,
  20260823090000_per_diem and 20260823140000_accounting_export, have never touched a
  database. Then npm run seed.
- npm run test — expect 727 green.
- npm run test:isolation — 223 assertions across 38 files, including the per-diem and
  accounting-export suites that have never executed. Fix any failure; a red isolation
  test is a tenant-leak until proven otherwise.
- npm run test:e2e — the signup → submit → approve → reimburse happy path.
- npm run test:a11y — axe over every route in the spec. It has never run, so expect real
  findings. Fix each violation; do not disable a rule to make it pass. The only
  pre-authorised exclusion is color-contrast, which check-contrast.mjs covers
  deterministically.
- npm run screenshots — docs/screenshots/ currently holds only a README, so there is no
  visual baseline. Capture desktop and mobile for every key screen.
- Lighthouse on /dashboard, /expenses, /expenses/new against a production build.
  Targets: Performance ≥90, Accessibility ≥95, CLS <0.05, INP <200ms.

STEP 3 — MANUAL PASSES THAT NO SCRIPT COVERS
- Keyboard walkthrough of submit expense, approve report, mark reimbursed: full
  operability, logical focus order, visible ring on every stop, focus trapped and
  restored in dialogs and sheets, Esc closes overlays.
- Screen-reader pass (NVDA or VoiceOver) on the same three flows: labels announced,
  errors announced via aria-live, status badges readable, table headers scoped,
  icon-only buttons named.
- Responsive check at 360, 390, 768, 1024, 1440px on add-expense, expense list, approval
  queue, dashboard, ledger, reconciliation: no horizontal scroll, no truncated amounts,
  touch targets ≥44px.

STEP 4 — RECORD HONESTLY, THEN TICK
- Replace the "not run" sections of docs/PERF-AUDIT.md and docs/A11Y-AUDIT.md with
  measured numbers, the violations found, and the fixes applied.
- Tick D5.3, D5.4, D5.5 in DESIGN-PLAN.md ONLY for what actually passed. If a target is
  missed and not fixed this session, leave the box unticked and write down the number —
  the same discipline that un-ticked them in the first place.
- Update docs/FINAL-AUDIT-ROUND2.md section 6 to reflect what closed.

Commit as separate pieces: "fix: unblock build toolchain", "test: execute full
verification suite", "docs: record measured a11y and performance results".
```

---

## After V2

If everything passes, the product is releasable. The only remaining backlog item is direct
two-way accounting sync (OAuth + live API adapters) — the export layer built in F5 was
designed so those drop in without reshaping the schema.

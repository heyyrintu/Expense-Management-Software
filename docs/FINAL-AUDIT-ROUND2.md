# FINAL-AUDIT-ROUND2.md — Re-verification after F1–F6

**Date:** 2026-08-23 · **Scope:** verify the 16 punch-list items from `docs/FINAL-AUDIT.md` actually landed in code.
**Method:** independent grep/AST inspection of the codebase, execution of all four design checkers, `tsc --noEmit`, and `git status` — not a doc review.

---

## Verdict

**14 of 16 items fully landed.** The token layer and wiring fixes are exemplary — 51 palette violations → **0**, duplicate accent token gone, CSV export reachable and filter-faithful, complaints widget on the dashboard, focus ring fixed, StatCard routed through a shared formatter. Per-diem and the accounting export layer are genuinely well-engineered new features, not stubs. Unit tests grew **590 → 727**, isolation **183 → 223**.

**But the build is currently broken, and it's a one-command fix.**

**Release status: BLOCKED on 4 items**, down from 9. Two are trivial; two need a working build host.

---

## 1. Gates

| Gate | Round 1 | Round 2 |
|---|---|---|
| `check-design-tokens.mjs` | ✅ (narrow scope) | ✅ **now covers all of `app/**` + `components/**`** |
| `check-copy-voice.mjs` | ✅ | ✅ |
| `check-motion.mjs` | ✅ | ✅ |
| `check-contrast.mjs` | ✅ 56 pairs | ✅ 56 pairs |
| ESLint | ✅ | ✅ |
| **`tsc --noEmit`** | ✅ clean | ❌ **56 errors** |
| **`npm run lint`** | ✅ | ❌ **fails** (chains `tsc`) |
| Unit tests | ~590 | **727 passed / 59 files** |
| Isolation tests | 183 | **223 `it` blocks / 38 files** — could not execute (Prisma engine binary is Windows-only in this mount) |
| e2e / a11y / Lighthouse | never run | **still never run** |

---

## 2. Blocker: stale Prisma client

`tsc --noEmit` returns **56 errors, all in F4/F5 files** — `tests/isolation/per-diem.test.ts` (20), `tests/isolation/accounting-export.test.ts` (17), `app/**` (16), `lib/accounting/queries.ts` (2), `prisma/seed.ts` (1).

Every one is a variant of `Property 'perDiemRate' does not exist on type 'PrismaClient'` or `Type '"per_diem"' is not assignable to type 'ExpenseType'`.

Root cause: `node_modules/.prisma/client/index.d.ts` still declares `ExpenseType: { regular, mileage }` and contains **zero** matches for `PerDiemRate`, `AccountingMapping`, or `AccountingExport`. It *does* contain `Complaint` and `whatsapp`, so the client is current through the Aug-21 commit and stale only for F4/F5 — **`prisma generate` was never run after the schema edits.**

```
npx prisma generate
npx tsc --noEmit          # expect clean
```

No source changes needed. Two commits (`d86bd0e`, `256b154`) shipped with `npm run lint` failing, violating the Definition of Done in CLAUDE.md.

**Note on commit `ea0c34f`:** it claims *"typecheck clean — every residual tsc error is the --no-engine Prisma client artifact in untouched infra files."* That is not accurate — all 56 errors are in F4/F5's own new files, none in untouched infra. The test-count claim in the same commit (727 unit tests green) **is** accurate.

---

## 3. Item-by-item

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | D-5 duplicate `--color-accent` | ✅ | `globals.css:167` is the sole declaration. Dead shadcn `:root` + second `@theme inline` deleted; the 2 remaining `oklch` hits are inside an explanatory tombstone comment, not a rule body |
| 2 | D-1 palette classes | ✅ | Independent grep: **0 matches across `app/**` + `components/**`** (was 51 in 12 files). `TOKEN_ONLY_DIRS = ["app","components"]` — full trees. Users page now renders `<StatusBadge status={u.status} />` at `settings/users/page.tsx:175` |
| 3 | G1 CSV export wiring | ✅ | `expenses-table.tsx:278` → `<ExportButton filters scope totalRows />`; href built by the shared `lib/domain/expense-list-query.ts`, so the export matches the visible query. Row cap disclosed pre-click. Test at `tests/unit/expense-export-href.test.ts` |
| 4 | G2 complaints dashboard widget | ✅ | `dashboard/page.tsx:264` calls `complaintSummary()` inside the shared `Promise.all`; `:93` builds the inbox href |
| 5 | D-6 command-palette focus ring | ✅ | `command-palette.tsx:124` — `focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-inset` on the container |
| 6 | D-7 StatCard formatter | ✅ | `stat-card.tsx:88` → `formatCount()` from `lib/format`; zero `toLocaleString` in file |
| 7 | G4 e2e + a11y in CI | ✅ | `ci.yml:88` installs Chromium; `:100` `npm run test:e2e`; `:103` `npm run test:a11y`; `:111` uploads the report |
| 8 | **D-2 axe suite executed** | ❌ | `A11Y-AUDIT.md:171` — *"the axe suite has not been executed"*; `:178` — *"the suite is therefore unproven."* Coverage **grew 18 → 34 routes + 2 overlays**, which is real work — but unrun |
| 9 | **D-3 Lighthouse / CLS / INP** | ❌ | `PERF-AUDIT.md:19` — *"Lighthouse — **not run**"*; `:44` — *"still not run, and D5.4 is now unticked"* |
| 10 | **D-4 screenshot baseline** | ❌ | `docs/screenshots/` still holds only `README.md`; zero image files |
| 11 | F4 per-diem | ✅ | `PerDiemRate` at `schema.prisma:389-413` with RLS at `20260823090000_per_diem/migration.sql:77-79`; settings screen, capture-flow variant, and a 30-line documented half-day rule at `lib/domain/per-diem.ts:3-33` (rounding HALF UP in the employee's favour). Receipt exemption explicit via `RECEIPT_EXEMPT_TYPES` in `policy.ts:38-65`. No special-casing downstream in ledger/exports/dashboard |
| 12 | F5 accounting export layer | ✅ | 3 models + RLS; `AccountingAdapter` interface at `lib/exports/accounting/types.ts:135-160` with quickbooks/tally/generic adapters; unmapped rows **block** the export rather than being dropped (`actions.ts:174`); double-export guard defaults to refusing |
| 13 | G3 monthly summary PDF | ✅ | `monthly-summary/route.ts:103-106` attaches **both** PDF and CSV as real attachments; `lib/exports/pdf.ts:1-22` documents why a dependency-free writer was chosen over a PDF library |
| 14 | G6 FX bidirectional | ✅ | `lib/fx/index.ts:19` cross-rate via a single base column; `tests/unit/fx.test.ts:72-143` covers inversion, cross-rate, and all 64 pairs both directions |
| 15 | D-9 dead dark-theme block | ✅ | Deleted; the 2 remaining matches are tombstone comments. Decision recorded in `DESIGN-PRD.md:27`. **Bonus catch:** `check-contrast.mjs` was re-bounded by brace depth — it had been parsing `:root` up to a literal comment string, so deleting that comment would otherwise have swept the whole stylesheet into the token set |
| 16 | G5 orphaned RLS script | ⚠️ | Deleted in HEAD, coverage migrated into `tests/isolation/rls.test.ts:34`. **But the file is still on disk and staged as an add** — the next commit resurrects it. Commit `ea0c34f` notes the mount forbade deletion |
| 17 | D-8 PRD token drift | ⚠️ | §5 fully rewritten to the real names (`--fg-*`, `--status-*`, `--line`) with a candid migration note. **§6 is still stale** — `DESIGN-PRD.md:242` says `--border-strong`, `:266` says `--border`. Drift moved rather than eliminated |

---

## 4. Working-tree hygiene

`git status` shows the index holding **pre-F6 content** while the worktree holds post-F6 — e.g. `scripts/check-contrast.mjs`: the index re-adds 30 lines that HEAD→index had removed. Also uncommitted: `.github/workflows/ci.yml`, `DESIGN-PRD.md`, `app/(app)/advances/advances-panel.tsx`, and the `.agents/skills/**` tree.

Recommend `git reset`, then re-stage deliberately, and confirm `scripts/check-rls-state.mjs` leaves the index.

---

## 5. What's honestly good here

The repo **did not fake the verification**. D5.3/D5.4/D5.5 were **un-ticked** in `DESIGN-PLAN.md` rather than left green, each with a "Done / Not done" split, and a new `docs/VERIFICATION-RUNBOOK.md` diagnoses the build failure with a plausible root cause: `pnpm-workspace.yaml` entries that literally read `set this to true or false`, plus two lockfiles producing a hybrid npm+pnpm `node_modules`. That is the correct response to a blocked verification — and it is exactly why the Prisma-client oversight is worth flagging rather than glossing: the same rigour wasn't applied to the DoD gate on two commits.

---

## 6. Remaining punch list

**Blockers**

1. **`npx prisma generate`** → unblocks `tsc`, `npm run lint`, `npm run build`, and both new isolation suites. One command.
2. **Fix the lockfile/workspace conflict** per `docs/VERIFICATION-RUNBOOK.md` (clean `npm ci`), then run `npm run build`. Everything below depends on this.
3. **Run and record**: `npm run test:isolation` against a real DB (F4/F5 isolation coverage is written but never executed), `npm run test:e2e`, `npm run test:a11y`, `npm run screenshots`, and Lighthouse on `/dashboard`, `/expenses`, `/expenses/new`. Fix what surfaces, then tick D5.3–D5.5.
4. **Apply the two new migrations** (`20260823090000_per_diem`, `20260823140000_accounting_export`) — they exist but have never touched a database.

**Cleanup**

5. Unstage/remove `scripts/check-rls-state.mjs` so the next commit doesn't resurrect it.
6. `git reset` and re-stage; commit the four stray worktree files.
7. Update `DESIGN-PRD.md:242` → `--line-strong` and `:266` → `--line`.
8. Update `A11Y-AUDIT.md:105,236` — they still claim 20-route coverage; the spec now covers 34.
9. Optional: `lib/exports/tally.ts` now has two entry points (the new adapter and `app/api/exports/ledger/route.ts:24`). Fine today, worth consolidating.

**Backlog (unchanged)**

10. Direct two-way accounting sync (OAuth + API adapters) — the layer is now built for it.

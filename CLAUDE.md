# CLAUDE.md — Expense Management SaaS (multi-tenant)

Multi-tenant expense management web app (Fyle/Sage-style). Source of truth for requirements: `PRD-expense-management-system.md`. Build order: `PLAN.md`. Do not invent features beyond the PRD phase you are working on.

## Stack

- **App**: Next.js 15 (App Router, TypeScript, strict mode)
- **UI**: Tailwind CSS + shadcn/ui; responsive, mobile-first for the expense-capture flow
- **DB**: PostgreSQL 16 + Prisma ORM; migrations via `prisma migrate`
- **Auth**: Auth.js (credentials provider), session JWT carries `userId`, `orgId`, `role`
- **Storage**: S3-compatible (local: MinIO) — receipts under `/{orgId}/receipts/{expenseId}/`
- **OCR**: stub interface `lib/ocr/index.ts` (`extractReceipt(file) -> {merchant?, date?, amount?}`); Tesseract.js implementation behind it. Never block expense creation on OCR failure.
- **Tests**: Vitest (unit) + Playwright (e2e); tenant-isolation test suite is mandatory
- **Validation**: Zod schemas shared between API and forms

## Commands

```bash
npm run dev            # start dev server (docker compose up -d first: postgres + minio)
npm run build          # production build — must pass before any commit
npm run test           # vitest
npm run test:isolation # cross-tenant isolation suite — must pass before any commit
npm run test:e2e       # playwright
npx prisma migrate dev # create/apply migration
npm run lint           # eslint + tsc --noEmit
npm run seed           # seed 2 demo orgs (acme, globex) with users of every role
```

## Non-negotiable rules

### Tenant isolation (the one rule that can never break)
- **Every table has `org_id`.** Every query is scoped by it. No exceptions.
- All DB access goes through `lib/db/scoped.ts` (`scopedDb(orgId)`), which injects `org_id` into every where/create. **Never call the raw Prisma client from route handlers or server components.**
- Postgres Row-Level Security is enabled on every tenant table as defense-in-depth; app sets `app.current_org_id` per request/transaction.
- `orgId` always comes from the server session — **never from request params, body, or headers**.
- Receipt signed URLs are generated only after verifying the receipt's `org_id` matches the session.
- Any new endpoint or query requires a matching case in `tests/isolation/` proving org B cannot read/write org A's data.

### Authorization
- Roles: `employee < approver < finance_admin < org_admin` (+ platform `super_admin`, no org data access).
- Check role server-side in every route handler/server action via `lib/auth/guard.ts` helpers (`requireRole(...)`). UI hiding is not authorization.
- An approver can never approve their own report.

### Domain invariants
- Report state machine: `Draft → Submitted → Approved | Rejected | SentBack → Reimbursed`. Transitions only through `lib/domain/report-workflow.ts`; every transition writes an `AuditLog` row.
- Money is stored as integer minor units (cents/paise), never floats. Use `lib/money.ts`.
- Policy violations **flag, never block** — approver may approve with a logged justification.
- Duplicate detection: same `org_id + user_id + amount + date + merchant` (case-insensitive merchant).
- Nothing is hard-deleted once a report leaves Draft; use status fields. AuditLog is append-only.

## Conventions

- Feature-folder layout: `app/(app)/[feature]/`, domain logic in `lib/domain/`, one Zod schema per entity in `lib/schemas/`.
- Server components by default; client components only for interactivity (`"use client"` at the leaf).
- API: server actions for mutations, route handlers only for uploads/webhooks/exports.
- Errors: return typed results `{ok, error}` from actions; no thrown strings; user-facing messages come from `lib/errors.ts`.
- Naming: DB `snake_case`, TS `camelCase`, components `PascalCase`. IDs are UUIDv7.
- Migrations: never edit an applied migration; additive first, destructive only with a backfill plan.
- Commits: conventional (`feat:`, `fix:`, `test:`, `chore:`); every feat commit includes its tests.


## Definition of done (every task)

1. `npm run lint && npm run build` clean
2. Unit tests for domain logic; isolation tests for any new data access
3. Works for both seed orgs (acme, globex) with no data bleed
4. AuditLog written for any state change
5. PLAN.md task checked off

## Design rules

Design authority: `DESIGN-PRD.md`. Plan: `DESIGN-PLAN.md`. Prompts: `DESIGN-PROMPTS.md`.

- **Tokens only** — no raw hex, no arbitrary Tailwind values (`text-[13px]`) in `app/**` or `components/**`. Lint enforces this.
- Light theme; indigo/violet accent; Inter with tabular numerals for all money; comfortable density (44px touch targets, 48px rows).
- Status color is defined **only** in `StatusBadge` via the map in DESIGN-PRD §5.2 — never hand-colored elsewhere.
- Amounts render through `<Amount>` (integer minor units in, never a pre-formatted string), dates through `<DateCell>`. No `toFixed`/`toLocaleString`/`Intl.*` in components. `formatMoney`/`formatDate` from `lib/` are for plain strings only — `<option>` labels, chart tooltips, emails, CSV — and each remaining call site says so in a comment. A server component must not pre-format money or a date into a string prop: pass the raw value and let the client child render it.
- `<DateCell format="relative">` is for activity and meta contexts only (comment timestamps, notification lists). Never for an expense date, report period, or anything in a column someone compares against a bank statement.
- **Tables**: every list uses `components/data-table` (TanStack **v8** — pinned deliberately; v9's plugin API is a redesign the ecosystem hasn't documented). Column metadata (`align`, `skeletonWidth`, `label`, `alwaysVisible`) rides `meta` through the `ColumnMeta` module augmentation in `components/data-table/types.ts` — never a parallel array of alignments. Pass `pagination={{ mode: "server", … }}` when the screen's query paginates, `{ mode: "client" }` when it doesn't. Filters belong in the `toolbar` slot. `app/(app)/expenses/expenses-table.tsx` is the reference implementation.
- **Filters**: `components/filters` — facets are config, not hand-assembled controls. **The URL is the state**, via `useUrlFilters()`; there is no second copy. Filtering is server-side (parse the URL in the page, narrow the query) — never filter rows already in the browser, which lies the moment the result set exceeds one page. Filters may only ever NARROW: combine them with `applyExpenseFilters(scope, filters)`, which ANDs them onto the scope predicate. Never spread a filter over a scope object — a `userId` facet would overwrite the pin and reach another user's rows.
- **KPIs and charts**: a StatCard's `href` and its number come from ONE query — `buildExpenseStats` totals the screen's where-clause and serialises that same filter into the link (§7.4: the number and the list must always agree). Never compute a KPI from a whole-set aggregate while the table it links to shows a capped page. Chart colour, grid, axes and animation come from `lib/charts/theme.ts`; those values are duplicated from the token layer because Recharts takes props not classes, so `tests/unit/chart-theme.test.ts` holds them to it.
- **Capture flow**: money is entered through `<AmountInput>` — display-size, grouped at rest and plain on focus, and it NEVER silently rounds (extra precision is refused, not truncated). Parsing lives in `normalizeAmountInput` in `lib/money.ts`. Policy violations render as `<PolicyFlagChips>` under the field that caused them: a 150ms opacity fade, no shake, no scroll, no focus steal, no disabled submit — violations flag, never block.
- **Receipts**: `<ReceiptDropzone>` validates client-side with `validateReceiptFile` — the SAME pure function the upload route uses, so client and server never disagree about a file. Upload progress lives in reserved space and animates `scaleX`, never width. `<OcrReviewCard>` treats a failed read as ordinary (no danger tokens, no apology): `lib/ocr` resolves to `{}` for every PDF and every unreadable photo. Its low-confidence underline is built but unwired — `OcrResult` carries no confidence, and deriving one would be a guess wearing a warning colour.
- **Submitting a report** goes through `SubmitDialog`: count, total, the approver's NAME and any flags. The approver is resolved server-side by the same `resolveChain` the submit action uses — never recomputed in the browser, or the dialog could name someone the notification doesn't reach. The status timeline comes from `buildReportTimeline`: a rejection STOPS the stepper rather than reversing it, and `partially_reimbursed` never renders as Paid.
- **Approving is optimistic but the commit is DEFERRED, not reversed**: the row hides, a 5s undo toast runs, and `decideReportAction` fires only when that window closes untouched. Never approve-then-un-approve — there is no reversal action, and it would write an AuditLog entry for something that didn't happen. A server refusal restores the row and says why. The approval queue is the one sanctioned exception to the `components/data-table` rule: §7.3 needs a warning left edge, a `collapseRow` exit and inline decisions, and its unit of work is a decision, not a cell.
- **Money movement is never optimistic**: the payment run is a two-step sheet — set method, date and per-report reference/amount, then review every line and the batch total at display size before committing. The sheet shows a real pending state and stays open on a partial failure so finance can see which lines landed. The review screen's arithmetic is `summariseBatch` in `lib/domain/payment-batch.ts`, and `tests/unit/payment-batch.test.ts` holds it to accepting exactly what `planPayment` accepts — a preview that disagrees with the server is a screen promising payments that won't happen. A refused line contributes zero to the total, and one bad line blocks the whole batch. Bank details are shown as presence only, never the number.
- **Dashboards** (`/dashboard`, one route, three role variants): ONE where-clause feeds the KPI strip, both charts and every panel — the resolved scope ANDed with the URL's filters — and each card's `href` is that same filter state serialised back out, so a card and the list it opens are the same query narrowed differently. A KPI that genuinely cannot be an expense sum declares `agreement: { kind: "different", note }` in `lib/domain/dashboard-kpi.ts`; the type REQUIRES the note, and `KpiStrip` prints it under the grid. Never let a card whose number is computed differently look exact — one unreconcilable figure discredits the whole strip. Grid classes live in `app/(app)/dashboard/layout-grid.ts` and are imported by both the page and `DashboardSkeleton`, so the loading state cannot drift from the layout it reserves.
- **Expense list scope**: `?scope=mine|team|org` REQUESTS a width; `resolveExpenseScope` sets the ceiling from the session role and `viewScopeWhere` clamps to it, so the parameter can only ever narrow. It is not a filter and never travels in `ExpenseFilters`. Any screen paginating expenses sorts by `EXPENSE_LIST_ORDER` — a paginated sort must be a TOTAL order, or tied rows shuffle between pages and the KPI stops matching the list you add up.
- **Ledger** (`/ledger`, §7.5): a STATEMENT, not a list — the second sanctioned exception to the `components/data-table` rule, because its rows are meaningless out of order (each carries the balance the row above produced) and it has to print. Balance is semibold tabular with negatives in the danger token; alternating rows are `ledger-row-alt` (`--bg-subtle` at 40%, opaque via `color-mix` so the sticky header can't show through). The screen and `/api/exports/ledger` share ONE derivation — `resolveLedgerEntity` → `fetchEntityLedger` → `buildLedger`, windowed by `parseLedgerWindow` — so on-screen totals and the CSV cannot disagree; neither computes a total of its own. `resolveLedgerEntity` is the guard: anything below `finance_admin` is forced back to its own user ledger, so `?entity=department` from an employee changes nothing. Project rollups apportion a report across ALL its projects and read one key, so the shares stay lossless. A rollup that omits a line type says so via `entityCaveat` on screen.
- **Ledger dates**: `to` is 23:59:59.999 of the day named, because ledger events carry timestamps — an exclusive midnight `to` drops every event on the last day, which is the day a quarter-end ledger is run for. Date strings are validated for REALITY, not just shape: `2026-13-45` matches the regex and yields an Invalid Date, which compares false against everything and silently returns a blank statement.
- **Print** is a real layout (`@media print` in `app/globals.css`), not the screen with its colours knocked out: tokens are overridden at `:root` so nothing can be missed, `[data-slot^="app-"]` chrome is hidden, `thead`/`tfoot` become `table-header-group`/`table-footer-group` so the header repeats on every page and totals land last, and rows carry `break-inside: avoid`.
- **Non-filter query params** (`scope`, `entity`, `id`) must be passed to `useUrlFilters(preserve)` by any screen that uses both. `setFilters` rebuilds the query string from the filter state alone, so anything not preserved is dropped — silently throwing the reader from an org-wide or project view back to their own.
- One primary (filled) button visible per screen.
- **Motion**: see the Motion rules section below.
- Money movement is never optimistic. Approvals may be optimistic with a 5s Undo.
- **Any new or changed component must be added to `/design-system` in the same commit.** The gallery is the review surface: look at a component there before changing it and again after. Every state goes on the page — a state that isn't there isn't specified. If a component ships still deviating from the token layer, mark it with `DebtNote` and the task that fixes it rather than leaving the gap invisible. The gallery is open in development and requires `org_admin` in production (`lib/design/gallery-access.ts`).
- **App shell**: screens render inside `components/shell/AppShell` — they must not add their own header, sidebar, page padding or max-width. Start every screen with `<PageHeader title description action />`; `action` holds the screen's single primary button.
- **Navigation**: `components/shell/nav.ts` is the only nav model, and its `minRole` mirrors each route's existing server guard — it never replaces one. Add a route's guard first, then mirror it there and in `tests/unit/nav.test.ts`.

## Motion rules

DESIGN-PRD §4 principle 4, quoted as project law. Every animation in the app
obeys these; if one can't, it doesn't ship.

- Enter animations use `ease-out`; exits use `ease-in`. **Never `ease-in-out` for UI.**
- 150–250ms for most transitions. Anything over 400ms feels broken; **300ms is the hard ceiling**.
- Animate `transform` and `opacity` only. **Never animate layout properties.**
- Animations must be **interruptible** — a user clicking twice fast never sees a stuck state.
- Elements animate **from their origin** — a dropdown scales from the trigger, a sheet slides from the edge it belongs to.
- Springs for anything the user drags or that should feel physical (sheets, toasts); duration-based easing for everything else.
- `prefers-reduced-motion` disables transforms, keeps opacity fades.

In practice:

- All durations, easings, springs and shared variants come from `lib/motion.ts`. A component that writes its own numbers has opted out of the design system — don't.
- `MotionProvider` (in the root layout) sets the default transition and `reducedMotion="user"`. `app/globals.css` handles the CSS side. Both are required.
- `collapseRow` is the **only** sanctioned exception to transform/opacity-only: removing a row from a list has to animate height so the rows below close the gap. Nothing else may.
- If an animation doesn't communicate state, direction, or origin — delete it, don't tune it.

## Skills

Use the project skills in `.claude/skills/` (see `SKILLS.md`): `add-feature-module`, `tenant-isolation-check`, `db-migration`, `ui-screen`, `design-craft`. Invoke the relevant skill before starting matching work.

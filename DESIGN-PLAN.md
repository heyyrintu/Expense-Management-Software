# DESIGN-PLAN.md — UI/UX Build Plan

Design milestones D0–D5. Reference: `DESIGN-PRD.md`. Prompts: `DESIGN-PROMPTS.md`.
Run these **after** structural build; each task ≈ one Claude Code session and must not change business logic — only presentation, tokens, and interaction.

**Rule for every design task:** no raw hex/px outside tokens · no logic changes · screenshots before/after in the commit body · `npm run lint && npm run build && npm run test && npm run test:isolation` stay green.

## Milestone D0 — Foundation

- [x] **D0.1 Token layer**: `app/globals.css` CSS custom properties + `tailwind.config.ts` mapping for all color, radius, shadow, spacing, and motion tokens from DESIGN-PRD §5. Inter via `next/font` with `tnum` enabled on numeric utility class. ESLint rule banning raw hex in `app/**` and `components/**`.
  - Two deviations, both deliberate: **no `tailwind.config.ts`** — Tailwind v4 is CSS-first and `@theme` in `globals.css` *is* the config, so a JS config would be a second source of truth; and the raw-hex ban is **`scripts/check-design-tokens.mjs`** wired into `npm run lint` rather than an ESLint rule, because it also catches arbitrary values (`text-[13px]`) and palette classes, which an ESLint rule on JSX strings would miss.
- [x] **D0.2 Motion primitives**: install Framer Motion, Sonner, Vaul. `lib/motion.ts` exporting duration/easing/spring constants + shared variants (fadeScale, slideUp, collapse). Global `prefers-reduced-motion` handling. Motion usage rules added to CLAUDE.md.
- [x] **D0.3 Primitive components**: restyle shadcn Button, Input, Select, DatePicker, Badge/StatusBadge (reading the §5.2 status map), Card, Tabs, Dialog, Sheet (Vaul on mobile), Toast (Sonner), Tooltip, Skeleton, EmptyState. All states incl. focus-visible and loading-without-layout-shift.
- [x] **D0.4 App shell**: sidebar (240px, collapsible icon rail), top bar (org switcher if multi-org user, search, notifications, avatar menu), mobile bottom tab bar with center Add action, breadcrumbs, page header pattern (title + description + primary action slot). Role-aware nav.
- [x] **D0.5 Storybook-lite gallery**: `/design-system` route (dev-only, org_admin-gated in prod) rendering every component, every state, the token palette, and the type scale. This is the review surface for all later tasks.

## Milestone D1 — Money & data presentation

- [x] **D1.1 Money & date formatting**: `<Amount>` component (tabular, right-aligned, org currency, negative in danger token, optional secondary original-currency line) and `<DateCell>`; used everywhere — grep for stray `toFixed`/`toLocaleString` in components and replace.
- [x] **D1.2 DataTable**: TanStack-based shared table — sticky header, 48px rows, hover/selected treatments, column visibility, server pagination, sort indicators, row skeletons, empty state, and the mobile card-collapse variant. Migrate expense list to it.
- [x] **D1.3 Filter bar**: shared filter component (search, date range, multi-select facets) with URL state sync, active-filter chips, "Clear all", and mobile filter sheet with active-count badge.
- [x] **D1.4 StatCard + charts**: KPI card (label/value/delta/sparkline) and Recharts theme (accent series, restrained categorical palette, token grid/tooltips, mount-only draw-in). Numbers agree with linked tables — click-through wired.

## Milestone D2 — Capture flow (highest-impact screens)

- [x] **D2.1 Add/Edit Expense**: mobile-first single column per DESIGN-PRD §7.1; AmountInput (paste-tolerant, minor-unit safe); sticky action bar; inline policy chips; autosave draft indicator.
- [x] **D2.2 ReceiptDropzone + OCRReviewCard**: drag-over states, camera capture on mobile, thumbnail grid, upload progress without layout shift, OCR "extracted" chips with low-confidence emphasis, graceful OCR-failure copy.
- [x] **D2.3 My Expenses & report builder**: list → bulk select → floating action bar → add to report; report detail with expense rows, totals footer, submit confirmation dialog showing what will be sent.

## Milestone D3 — Review & finance screens

- [x] **D3.1 Approval queue**: flagged-first ordering with warning edge accent, decide-without-opening row density, optimistic approve with 5s Undo toast, bulk-approve gating with explanatory disabled state, reject/send-back dialogs with mandatory reason.
- [x] **D3.2 Finance queue & payment proof**: reimbursement batch flow UI, PaymentProofViewer lightbox, partial-payment balance display, batch summary confirmation before committing money (never optimistic).
- [x] **D3.3 Dashboards**: employee / approver / finance layouts per §7.4, responsive grid, persisted URL filters, KPI→table click-through, loading skeletons matching final layout.

## Milestone D4 — Advanced surfaces

- [x] **D4.1 Ledger view**: Tally-style table per §7.5 — sticky header + totals footer, entity segmented control, running-balance emphasis, print stylesheet, export menu.
- [x] **D4.2 Reconciliation wizard**: 3-step sheet (upload → map columns with live preview → review), three-bucket board with counts and summary strip, manual-match search UI, period-lock confirmation.
- [x] **D4.3 Complaints thread**: conversation layout, SLA badge, composer, resolve dialog requiring resolution note, finance inbox with aging.
- [x] **D4.4 Settings & admin**: users, departments, categories, org settings, WhatsApp linking — consistent settings layout (left section nav + form panels), destructive-action confirmations, invite flow polish.

## Milestone D5 — Polish & verification

- [x] **D5.1 Empty, loading, error states sweep**: every route gets purposeful empty state, shape-matched skeleton, and error boundary with recovery action. Audit checklist committed.
- [x] **D5.2 Motion audit**: every animation checked against DESIGN-PRD §4.4 — duration ≤300ms, correct easing direction, transform/opacity only, interruptible, origin-anchored, reduced-motion respected. Remove anything decorative.
- [ ] **D5.3 Accessibility audit**: axe automated pass in CI, keyboard walkthrough of the three critical flows, screen-reader pass, contrast verification, focus-order fixes. Target Lighthouse a11y ≥95.
  - Done: contrast verified deterministically (`scripts/check-contrast.mjs`, 56 pairs, in `npm run lint`); focus-order fixes applied (D-6 command palette); the axe suite is written, now covers **all 34 id-less routes plus 2 overlays** (was 18 — see `tests/unit/a11y-coverage.test.ts`, which fails the build if a route is added without being scanned) and **is now invoked by CI**.
  - **Not done: the axe suite has still never been executed**, so it is unproven. No keyboard walkthrough, no screen-reader pass, no Lighthouse a11y score. All four need a browser against a running app.
  - Blocked on the build/dev-server failure — see `docs/VERIFICATION-RUNBOOK.md`, which has a diagnosis and the exact sequence.
- [ ] **D5.4 Performance & responsive pass**: Lighthouse ≥90 on dashboard, CLS <0.05, INP <200ms; test at 360px, 768px, 1024px, 1440px; font loading without FOUT; image/receipt lazy loading.
  - Done: bundle work is real and measured from a production build — `/dashboard` 342 → 229 kB, `/analytics` 237 → 119 kB; receipts lazy-load; charts are behind `next/dynamic`.
  - **Not done: Lighthouse has never been run.** Performance, CLS and INP are all unmeasured. The three targets are predictions, not results.
- [ ] **D5.5 Design QA**: walk `/design-system` gallery, verify token-only styling (lint clean), consistent status colors across table/card/chart/print, and cross-screen consistency of amounts, dates, and empty states.
  - Done: gallery walked and extended; token-only lint clean across `app/**` and `components/**` (the palette-class rule was covering 4 paths and now covers both trees); status colour routed through `StatusBadge` everywhere.
  - **Not done: the screenshot baseline was never captured** — `docs/screenshots/` holds only a README, so there is no visual regression reference to diff against.

> **Why these three are unticked.** They were ticked while `docs/A11Y-AUDIT.md`
> and `docs/PERF-AUDIT.md` each said, in their own words, that the work had not
> run. A checkbox that disagrees with its own evidence is worse than an empty
> one: it stops the next person looking. They get ticked when the numbers
> exist, not before.

## Sequencing note

D0 must complete before anything else — later tasks assume tokens, primitives, and shell exist. D1 before D2/D3 (they consume Amount, DataTable, FilterBar). D4 depends on the corresponding features being built (6.1, 7.1–7.3). D5 runs last, then repeats briefly after any new feature ships.

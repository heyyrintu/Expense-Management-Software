# DESIGN-PROMPTS.md — Claude Code prompts for design tasks (D0–D5)

One prompt = one session. Paste as-is. Every prompt assumes `DESIGN-PRD.md`, `DESIGN-PLAN.md`, `CLAUDE.md` and the skills in `.claude/skills/` are in the repo.

**Global rules injected into every design session** (already stated in each prompt, repeated here for reference):
no raw hex or off-scale px outside tokens · no business-logic changes · motion follows DESIGN-PRD §4.4 · `npm run lint && npm run build && npm run test && npm run test:isolation` must stay green · update `/design-system` gallery when a component changes.

---

## D0.1 Token layer

```
Read DESIGN-PRD.md sections 4–5 and CLAUDE.md, then do task D0.1 — Token layer.
Invoke the design-craft skill.

1. Define every token from DESIGN-PRD §5 as CSS custom properties in app/globals.css
   under :root — color (neutrals, indigo accent scale, semantic status), radius,
   elevation, spacing scale, and motion (durations, easings). Structure them so a
   [data-theme="dark"] block could override colors later without touching components.
2. Map all tokens into tailwind.config.ts (colors.bg.*, colors.text.*, colors.accent.*,
   colors.status.*, borderRadius, boxShadow, transitionDuration, transitionTimingFunction)
   so components use semantic class names, never arbitrary values.
3. Load Inter via next/font (variable, subset latin, display swap). Add a .tabular
   utility applying font-feature-settings: "tnum" 1 and apply it to a base Amount class.
   Implement the type scale from §5.3 as Tailwind text-* presets.
4. Add an ESLint rule (or a simple custom rule / regex lint script wired into npm run
   lint) that fails on raw hex colors and on arbitrary Tailwind values like text-[13px]
   inside app/** and components/**. Document the exception process in a comment.
5. Create app/(dev)/design-system/page.tsx showing the color palette with token names and
   contrast ratios, the type scale, spacing, radii, and elevations.

Do not restyle any feature screens in this task. DoD: lint/build green, gallery renders,
check off D0.1 in DESIGN-PLAN.md, commit "design: D0.1 token layer".
```

## D0.2 Motion primitives

```
Read DESIGN-PRD.md §4 principle 4 and §5.6, then do task D0.2 — Motion primitives.
Invoke the design-craft skill.

1. Install framer-motion, sonner, vaul.
2. Create lib/motion.ts exporting: DURATION {instant:100, fast:150, base:200, slow:300},
   EASE {out:[0.16,1,0.3,1], in:[0.4,0,1,1]}, SPRING {soft:{stiffness:300,damping:30},
   snappy:{stiffness:500,damping:35}}, and shared Framer variants: fadeScale (0.96→1),
   slideUpSheet, collapseRow (height+opacity for optimistic row removal), staggerList.
3. Rules enforced in code: enters use EASE.out, exits use EASE.in, only transform and
   opacity are animated, all animations interruptible (no animation-complete state locks).
   Add a short "Motion rules" section to CLAUDE.md quoting DESIGN-PRD §4.4 so future
   sessions inherit it.
4. Global reduced-motion support: a useReducedMotion-aware MotionConfig provider that
   strips transforms/springs and keeps opacity fades; verify with the OS setting on.
5. Add a Motion section to /design-system demonstrating each variant with a replay button.

DoD: gallery demos work, reduced-motion verified, check off D0.2,
commit "design: D0.2 motion primitives".
```

## D0.3 Primitive components

```
Read DESIGN-PRD.md §6.1, then do task D0.3 — Primitive components.
Invoke the design-craft and ui-screen skills.

Restyle/build on shadcn/ui using ONLY tokens from D0.1 and motion from D0.2:
Button (primary/secondary/ghost/destructive/link × sm/md/lg, loading state that preserves
width — no layout shift, active scale 0.98), Input, Select, DatePicker, Textarea,
Checkbox/Radio/Switch, Badge, StatusBadge (single component reading the status map in
DESIGN-PRD §5.2 — no status color defined anywhere else), Card, Tabs (animated active
indicator via shared layout), Dialog (scale+fade 200ms), Sheet (Vaul bottom sheet on
mobile with drag-to-dismiss, side sheet on desktop), Toast via Sonner (success/error/undo),
Tooltip, Skeleton, EmptyState (icon-in-circle, headline, one line, one action).

Every component: default/hover/active/focus-visible/disabled states, visible focus ring
(2px accent, 2px offset), 44px minimum touch target on interactive elements, keyboard
operable, correct ARIA.

Render every component and every state in /design-system.
DoD: no raw hex (lint proves it), gallery complete, check off D0.3,
commit "design: D0.3 primitives".
```

## D0.4 App shell

```
Read DESIGN-PRD.md §5.5 and §7, then do task D0.4 — App shell.
Invoke the ui-screen and design-craft skills.

1. Desktop: fixed 240px sidebar — logo/org name, role-aware nav sections (Expenses,
   Reports, Approvals, Finance, Settings), collapsible to a 64px icon rail with tooltips,
   collapse state persisted. Active item uses --accent-subtle pill + accent text.
2. Top bar: page context left, global search / ⌘K trigger, notifications bell with unread
   dot, avatar menu (profile, org, sign out). Sticky, 1px bottom border, no shadow.
3. Mobile (<768px): sidebar becomes a bottom tab bar — Home, Expenses, Add (accent circle,
   center), Reports, More. Safe-area insets respected.
4. Page primitives: <PageHeader title description action />, breadcrumbs, content max-width
   1280px, 24px/16px padding per breakpoint.
5. Role-aware nav rendering from session role — but keep the existing server-side guards
   untouched; UI hiding is not authorization.

Verify at 360/768/1024/1440px. DoD: check off D0.4, commit "design: D0.4 app shell".
```

## D0.5 Design-system gallery

```
Read DESIGN-PLAN.md D0.5, then do task D0.5 — Design-system gallery.

Consolidate /design-system into the project's review surface: sections for Tokens
(color swatches with token name + hex + contrast ratio vs. white and vs. --text-primary),
Typography (full scale with specimen text and tabular numeral demo), Spacing/Radius/
Elevation, Components (every primitive, every state), Domain components (added as they
are built), Motion (replayable demos), and Patterns (empty/loading/error trio).

Dev-only by default; in production require org_admin. Add a note in CLAUDE.md: "any new
or changed component must be added to /design-system in the same commit."
DoD: check off D0.5, commit "design: D0.5 gallery".
```

---

## D1.1 Money & date formatting

```
Read DESIGN-PRD.md §5.3 and §6.2, then do task D1.1 — Money and date presentation.

1. Build <Amount value currency size variant /> — renders minor units via lib/money.ts,
   tabular figures, right-aligned in tables, negative values in the danger token with a
   minus (never parentheses-only), optional secondary line showing original currency for
   multi-currency expenses. Sizes: display / body / meta.
2. Build <DateCell value format /> with one project-wide date format (dd MMM yyyy) and a
   relative variant ("2 days ago") for activity/meta contexts only.
3. Grep the codebase for toFixed, toLocaleString, Intl.NumberFormat, and ad-hoc date
   formatting inside components; replace all with these components. Formatting logic stays
   in lib/money.ts — components only present.
4. Add both to /design-system with edge cases: zero, negative, very large (₹1,23,45,678.90),
   foreign currency, missing value.

DoD: no direct number/date formatting left in components, check off D1.1,
commit "design: D1.1 money and date presentation".
```

## D1.2 DataTable

```
Read DESIGN-PRD.md §6.1 DataTable, then do task D1.2 — Shared DataTable.
Invoke ui-screen and design-craft skills.

Build components/data-table with TanStack Table: sticky header, 48px rows, hover
--bg-subtle, selected --accent-subtle with 2px left accent bar, sort indicators, column
visibility menu, server-side pagination past 50 rows, row-level skeletons matching final
column widths, integrated EmptyState, and a responsive variant that collapses to stacked
cards under md (primary line = merchant + Amount, secondary = date/category/status).
Amounts always right-aligned tabular via <Amount>. Row selection with a floating bulk
action bar that slides up (200ms ease-out) when a selection exists.

Migrate the expense list screen to it as the reference implementation. Do not change any
query or business logic — presentation only.
DoD: check off D1.2, commit "design: D1.2 data table".
```

## D1.3 Filter bar

```
Read DESIGN-PRD.md §7.2, then do task D1.3 — Shared filter bar.

Build components/filters: search input (debounced), date-range picker with presets (This
month, Last month, This quarter, Custom), multi-select facets (status, category,
department, project, user — passed in as config), active-filter chips with individual
remove and "Clear all". State syncs to the URL query string so views are shareable and
survive refresh. Under md, collapses to a single "Filters" button opening a Vaul sheet
with an active-count badge.

Wire it into the expense list; leave other screens for their own tasks.
DoD: URL state verified on refresh and share, check off D1.3,
commit "design: D1.3 filter bar".
```

## D1.4 StatCard & charts

```
Read DESIGN-PRD.md §6.2 (StatCard, Charts), then do task D1.4 — KPI cards and chart theme.

1. <StatCard label value delta trend href /> — 13px secondary label, 32px display value
   (tabular), delta chip with arrow in success/danger, optional sparkline. Value animates
   on first mount only (≤400ms, count-up), disabled under reduced-motion. Whole card is a
   link to the filtered table view when href is provided.
2. lib/charts/theme.ts for Recharts: primary series = --accent; categorical palette =
   accent plus four desaturated hues (no rainbow); grid lines --border at 50% opacity;
   axis labels in --text-tertiary 12px; tooltip styled as a Card with <Amount> values;
   mount-only 300ms draw-in; responsive container; accessible fallback (data table toggle
   or aria-label summarizing the series).
3. Add both to /design-system with loading and empty variants.

DoD: KPI numbers verified to match the filtered table they link to, check off D1.4,
commit "design: D1.4 stat cards and charts".
```

---

## D2.1 Add / Edit Expense

```
Read DESIGN-PRD.md §7.1, then do task D2.1 — Add/Edit Expense screen.
Invoke ui-screen and design-craft skills. Presentation only — no changes to actions,
validation rules, or the policy engine.

Mobile-first single column, field order: receipt → amount → merchant → category → date →
project → purpose. Build <AmountInput>: large display-size, numeric keypad on mobile,
accepts pasted "1,234.56"/"₹1234"/"1234.5", stores minor units, formatted on blur and raw
on focus, never silently rounds. Policy violations render as PolicyFlagChip below the
relevant field with a 150ms fade — informational, never blocking, never shaking.
Sticky bottom action bar: "Save draft" (ghost) + "Add to report" (primary, the only filled
button on screen). Autosave indicator ("Saved" with a subtle check, fades after 2s).
Mileage variant swaps amount for distance with the computed amount shown read-only.

Verify at 360px and on desktop. DoD: check off D2.1, commit "design: D2.1 add expense".
```

## D2.2 Receipt dropzone & OCR review

```
Read DESIGN-PRD.md §6.2 (ReceiptDropzone, OCRReviewCard), then do task D2.2.

1. <ReceiptDropzone>: drag-and-drop on desktop with a 100ms fill to --accent-subtle and
   dashed --accent-border on drag-over; camera/file capture on mobile; multi-file;
   thumbnail grid with hover remove; PDF shows a page-1 preview; upload progress rendered
   in reserved space so nothing shifts; clear error copy for >10 MB and unsupported types.
2. <OCRReviewCard>: extracted merchant/date/amount as editable fields each carrying a
   subtle "extracted" chip; low-confidence fields get a warning-token underline plus a
   "please check" hint; a single primary "Looks right" action; explicit, calm copy when
   OCR fails ("Couldn't read this receipt — enter the details yourself") with no error
   styling, since failure is expected and non-blocking.
3. Full-size receipt viewer: lightbox with zoom, rotate, download.

DoD: check off D2.2, commit "design: D2.2 receipt capture".
```

## D2.3 My Expenses & report builder

```
Read DESIGN-PRD.md §7.2, then do task D2.3 — My Expenses list and report builder.

1. Expense list using DataTable + FilterBar; bulk select → floating action bar →
   "Add to report" (existing or new).
2. Report detail: header (title, status badge, total as display Amount, action slot),
   expense rows with inline remove, totals footer, and policy-flag summary strip when
   flags exist.
3. Submit confirmation dialog: shows count, total, approver name, and any flags being
   sent — the user should never be surprised by what was submitted.
4. Status timeline on submitted reports: horizontal stepper (Submitted → Approved → Paid)
   with timestamps, current step in accent, using tokens only.

DoD: check off D2.3, commit "design: D2.3 expenses and report builder".
```

---

## D3.1 Approval queue

```
Read DESIGN-PRD.md §7.3, then do task D3.1 — Approval queue.
Invoke ui-screen and design-craft skills.

Flagged reports sort first with a 2px warning left-edge accent. Each row shows employee
(avatar+name), amount (hero, tabular), category summary, flag chips, and age — enough to
decide without opening. Inline Approve / Send back / Open actions.
Approve is optimistic: row fades and collapses (200ms, collapseRow variant) with a Sonner
"Approved — Undo" toast held 5s; a failed server response restores the row and shows an
error toast. Bulk approve is enabled only when no selected report carries a flag — when
disabled, the button tooltip states exactly why. Reject and Send back open dialogs with a
mandatory reason field (submit disabled until non-empty).
Empty state: "Nothing waiting on you" with a calm check mark, not a sad face.

Business logic (guards, state machine, AuditLog) is untouched — this is presentation and
interaction only. DoD: check off D3.1, commit "design: D3.1 approval queue".
```

## D3.2 Finance queue & payment proof

```
Read DESIGN-PRD.md §6.2 (PaymentProofViewer) and PLAN.md 6.1, then do task D3.2.

1. Finance reimbursement queue: approved reports with employee, amount, age, bank-details
   presence indicator; multi-select for a batch payment run.
2. Batch payment flow as a 2-step sheet: (a) set method, date, and per-report reference/UTR
   with a proof upload per report or per batch; (b) a summary review screen listing every
   payment and the batch total before committing. Money movement is NEVER optimistic —
   show a real pending state and a confirmed result.
3. <PaymentProofViewer>: lightbox for image/PDF proof with zoom, download, and a metadata
   sidebar (method, UTR, date, paid by).
4. Partial payments: show paid vs. balance with a thin progress bar in --accent, balance
   in the warning token, and a clear "Partly paid" StatusBadge.

DoD: check off D3.2, commit "design: D3.2 finance queue and payment proof".
```

## D3.3 Dashboards

```
Read DESIGN-PRD.md §7.4, then do task D3.3 — Dashboards (employee, approver, finance).

Finance: four StatCards (total spend, pending approvals, awaiting reimbursement,
outstanding to employees) → spend trend chart → category breakdown + top spenders.
Approver: team pending queue summary, team spend by month/category.
Employee: my spend this month, pending reimbursement, recent expenses, quick "Add expense".
All: filters persist in the URL, every KPI links to its filtered table view, skeletons
match the final layout exactly (no layout shift on load), responsive 12→1 column.

Verify each KPI equals the total of the table it links to — add a note in the PR if any
number is computed differently.
DoD: check off D3.3, commit "design: D3.3 dashboards".
```

---

## D4.1 Ledger view

```
Read DESIGN-PRD.md §7.5 and PLAN.md 7.1, then do task D4.1 — Ledger view.

Tally-style table: Date · Particulars · Debit · Credit · Balance. Balance column is
semibold tabular with negatives in the danger token. Sticky header AND sticky totals
footer (requested / approved / paid / outstanding). Alternating rows via --bg-subtle at
40% opacity — no heavy zebra striping. Entity switcher (User / Project / Department) as a
segmented control with animated indicator; entity picker beside it. Date-range filter
from the shared FilterBar. Export menu: CSV · Tally XML · Print.
Add a print stylesheet: white background, black text, no nav/sidebar, repeated table
header on each page, totals on the last page.

Presentation only — ledger math stays in lib/domain/ledger.ts.
DoD: verify on-screen totals match the CSV export, check off D4.1,
commit "design: D4.1 ledger view".
```

## D4.2 Reconciliation wizard

```
Read DESIGN-PRD.md §7.6 and PLAN.md 7.2, then do task D4.2 — Reconciliation UI.

1. Import wizard as a 3-step sheet with a progress indicator: Upload (drop CSV/XLSX,
   show detected rows) → Map columns (dropdown per required field with a live 5-row
   preview updating as mapping changes; "save this mapping for next time") → Review.
2. Results board: three labeled buckets — Matched (success), Not in bank (danger),
   Not in app (warning) — each with a count chip and a scrollable list. Above them a
   summary strip: period, matched %, unexplained amount (danger token if non-zero).
3. Manual match: select a statement line → search reimbursements → confirm; unmatch with
   confirmation. One-click "Record this payment" for the Not-in-app bucket.
4. Period lock: destructive-styled confirmation dialog explaining exactly what becomes
   read-only.

DoD: check off D4.2, commit "design: D4.2 reconciliation UI".
```

## D4.3 Complaints thread

```
Read DESIGN-PRD.md §7.7 and PLAN.md 7.3, then do task D4.3 — Complaints UI.

Employee: "Raise complaint" entry from report/payment pages opening a sheet with type
selector (cards, not a dropdown — four visible options), description, optional attachment.
Thread view: original complaint as a header card (type, linked report/payment, status,
SLA badge green/amber/red), message list styled like a support conversation (author,
timestamp, avatar; own messages subtly differentiated without chat bubbles), composer
pinned to the bottom.
Finance inbox: DataTable with status/type/age filters, SLA badge column, aging emphasis
on overdue rows. Resolve opens a dialog requiring a resolution note before enabling submit.
Status changes animate the badge with a 150ms crossfade.

DoD: check off D4.3, commit "design: D4.3 complaints UI".
```

## D4.4 Settings & admin

```
Read DESIGN-PRD.md §6 and PLAN.md 2.0, then do task D4.4 — Settings and admin screens.

Consistent settings layout: left section nav (Profile, Organization, Users, Departments,
Categories, Policies, Integrations) + right form panel, single column under md.
Screens: profile (incl. bank details with masked display and a reveal action), org
settings, users table with invite sheet and role/approver editors, departments, categories
with limit fields, WhatsApp number linking with OTP state machine (idle → code sent →
verifying → linked) rendered as clear inline states.
Destructive actions (deactivate user, delete category) use a confirmation dialog naming
the exact entity; the confirm button is destructive-styled and never the default focus.
Form pattern: sticky "Save changes" bar appearing only when the form is dirty, with
"Discard" beside it.

DoD: check off D4.4, commit "design: D4.4 settings and admin".
```

---

## D5.1 States sweep

```
Do task D5.1 — Empty, loading, and error states sweep.

Walk every route. For each: (a) purposeful EmptyState with one action and copy written for
a first-time user, (b) skeleton that matches the final layout's dimensions exactly so CLS
stays near zero, (c) error boundary with a plain-language message and a recovery action
(retry / go back), (d) offline/failed-mutation toast copy.
Produce docs/STATES-AUDIT.md listing every route × the four states with a checkmark, and
fix everything unchecked. Copy follows a consistent voice: direct, no apologies, no
exclamation marks, never blames the user.

DoD: audit doc committed with all rows complete, check off D5.1,
commit "design: D5.1 states sweep".
```

## D5.2 Motion audit

```
Do task D5.2 — Motion audit against DESIGN-PRD §4 principle 4.

Inventory every animation in the app into docs/MOTION-AUDIT.md with: component, trigger,
property animated, duration, easing, and verdict. Fix anything violating the rules —
duration >300ms, ease-in-out on UI, animating layout properties (width/height/top/left)
instead of transform, non-interruptible sequences, animations not anchored to their origin,
or purely decorative motion (delete those outright).
Verify with prefers-reduced-motion enabled: no transforms or springs run, opacity fades
remain, nothing becomes unusable or invisible.
Spot-check on a throttled CPU (4× slowdown) that no animation feels janky.

DoD: audit doc committed, zero violations remaining, check off D5.2,
commit "design: D5.2 motion audit".
```

## D5.3 Accessibility audit

```
Do task D5.3 — Accessibility audit (WCAG 2.1 AA).
Invoke the accessibility-review skill if available.

1. Add @axe-core/playwright automated checks over every key route to the e2e suite; fail
   CI on violations.
2. Keyboard walkthrough of the three critical flows (submit expense, approve report, mark
   reimbursed): full operability, logical focus order, visible focus ring everywhere,
   focus trapped and restored in dialogs/sheets, Esc closes overlays.
3. Screen-reader pass (VoiceOver or NVDA) on the same flows: form labels announced, errors
   announced via aria-live, status badges readable, tables have proper headers/scope,
   icon-only buttons have accessible names.
4. Contrast verification of every token pair in use; fix any below 4.5:1 body / 3:1 large
   and UI boundaries. Confirm no status is conveyed by color alone.
5. Charts: aria-label summary or a toggleable data table.

Record findings and fixes in docs/A11Y-AUDIT.md. Target Lighthouse accessibility ≥95 on
all key routes.
DoD: CI axe checks green, audit doc committed, check off D5.3,
commit "design: D5.3 accessibility audit".
```

## D5.4 Performance & responsive pass

```
Do task D5.4 — Performance and responsive verification.

1. Lighthouse on dashboard, expense list, and add-expense: performance ≥90, CLS <0.05,
   INP <200ms. Record before/after numbers in docs/PERF-AUDIT.md.
2. Fix common offenders: font loading FOUT (next/font display swap + preload), unoptimized
   receipt thumbnails (next/image with correct sizes), oversized client bundles (audit
   "use client" boundaries — push them to leaves), unnecessary re-renders in tables,
   missing Suspense boundaries around slow data.
3. Responsive verification at 360, 390, 768, 1024, 1440px on: add expense, expense list,
   approval queue, dashboard, ledger, reconciliation. No horizontal scroll, no truncated
   amounts, no overlapping elements, touch targets ≥44px.
4. Test with 200 rows of seeded data to confirm table virtualization/pagination holds up.

DoD: targets met and documented, check off D5.4,
commit "design: D5.4 performance and responsive".
```

## D5.5 Design QA

```
Do task D5.5 — Final design QA.
Invoke the design-craft skill.

1. Walk /design-system: every component present with every state, tokens documented,
   contrast ratios shown.
2. Run the raw-hex/arbitrary-value lint across the whole repo — must be zero.
3. Cross-screen consistency check: the same status renders identically in table, card,
   badge, chart legend, and print; amounts always tabular and right-aligned in tables;
   dates use one format; empty-state copy shares one voice; only one primary button is
   visible per screen.
4. Compare each key screen against its DESIGN-PRD §7 spec and note deviations —
   fix or justify each in docs/DESIGN-QA.md.
5. Take screenshots of all key screens at desktop and mobile widths into docs/screenshots/
   as the visual baseline for future regressions.

DoD: QA doc + screenshots committed, check off D5.5,
commit "design: D5.5 design QA".
```

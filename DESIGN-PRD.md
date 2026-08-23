# DESIGN-PRD.md — UI/UX & Design System

**Product:** Expense Management SaaS (multi-tenant) · **Version:** 1.0 · **Date:** 2026-08-19
**Direction:** Minimal, modern, light-themed. Apple HIG restraint + Emil Kowalski motion craft.
**Decisions locked:** indigo/violet accent · comfortable density · Inter with tabular numerals · purposeful motion only.

---

## 1. Design Problem

The current build is functionally complete but visually undefined. Finance software fails users in two directions: enterprise tools (Concur) are dense and hostile, and consumer-styled tools over-decorate until numbers become hard to trust. Employees abandon expense apps because submitting feels like paperwork; finance teams distrust dashboards where numbers are hard to scan.

We need an interface where **the data is the interface**: numbers legible at a glance, one obvious action per screen, motion that explains state changes rather than decorating them.

## 2. Design Goals

1. **Submit an expense in under 60 seconds on a phone** — the capture flow is the product's front door.
2. **Numbers are unambiguous** — tabular figures, right-aligned amounts, consistent currency formatting, no truncation of money.
3. **Status is readable without reading** — a user identifies report state from across the room via one consistent badge system.
4. **Zero decorative motion** — every animation communicates state, direction, or origin.
5. **WCAG 2.1 AA throughout** — 4.5:1 text contrast, 44×44px touch targets, full keyboard operation.

## 3. Non-Goals

| Non-goal | Why |
|---|---|
| Dark mode in v1 | Light theme locked; tokens are structured so dark mode is a later variable swap, not a rewrite. **A provisional `[data-theme="dark"]` palette sat in `app/globals.css` for five milestones and was deleted on 2026-08-23 (D-9)**: nothing applied the attribute, and five of its status tokens were invisible to `scripts/check-contrast.mjs`, which reads the light `:root` only. Inert unverified colour is how `--fg-tertiary` shipped at 2.56:1. The structural claim still holds — components reference semantic names, never raw values — and it does not need a palette in the stylesheet to prove it. When dark mode is scheduled, add the block back **and** extend the contrast checker in the same commit. |
| Custom illustration set | Costly; use geometric empty-state marks built from existing icons |
| Per-tenant theming beyond logo | White-label theming is a P2 platform feature |
| Marketing site design | Different problem, different constraints |
| Chart micro-interactions (brush, zoom) | Read-only charts in v1; complexity without proven demand |

---

## 4. Design Principles

**1. Restraint is the aesthetic.** Every element earns its place. Prefer removing a border over adding a color. One accent color, used sparingly, means it always signals "act here."

**2. Hierarchy through space and weight, not lines and boxes.** Separate sections with whitespace before reaching for a divider. Cards get a subtle border (`border-neutral-200`), never a heavy shadow.

**3. The number is the hero.** In any row, card, or chart, the monetary value gets the strongest typographic treatment. Labels are secondary — smaller, lighter, never bold.

**4. Motion explains, never entertains.** (Emil Kowalski's rules, adopted verbatim as project law:)
- Enter animations use `ease-out`; exits use `ease-in`. Never `ease-in-out` for UI.
- 150–250ms for most transitions. Anything over 400ms feels broken.
- Animate `transform` and `opacity` only. Never animate layout properties.
- Animations must be **interruptible** — a user clicking twice fast never sees a stuck state.
- Elements animate **from their origin** — a dropdown scales from the trigger, a sheet slides from the edge it belongs to.
- Springs for anything the user drags or that should feel physical (sheets, toasts); duration-based easing for everything else.
- `prefers-reduced-motion` disables transforms, keeps opacity fades.

**5. Optimistic, honest feedback.** Actions respond instantly; if the server disagrees, the UI reverts with a clear toast. Never a spinner where an optimistic update will do — never an optimistic update where money is being moved.

**6. One primary action per screen.** Exactly one filled indigo button in view at a time. Everything else is secondary (bordered) or tertiary (text).

**7. Trust through consistency.** The same amount, status, or date renders identically in a table, a card, a WhatsApp message, and a PDF export.

---

## 5. Design Tokens

Implemented as CSS custom properties in `app/globals.css`. **No raw hex values anywhere in components.**

> **This section was rewritten on 2026-08-23 to match the code (D-8).** Names
> changed during the build — `--text-*` → `--fg-*`, `--success` →
> `--status-success`, `--border` → `--line` — and this document was not
> updated, so for five milestones the PRD named tokens that did not exist.
> A spec that has to be cross-checked against the source is not a spec.
> **Docs follow code here**: three of the values below were also corrected
> during the D5.3 contrast pass, and those corrections are the truth.
>
> There is no `tailwind.config.ts`. Tailwind v4 is CSS-first and the `@theme`
> block in `app/globals.css` IS the config; adding a JS config alongside it
> would create a second source of truth.

### 5.1 Color — Light theme

The raw values live in `:root`; `@theme inline` maps them to the Tailwind
utility names in the right-hand column.

```css
/* Neutrals (the interface) */
--bg-app:      #FAFAFA;  /* page background          → bg-bg-app      */
--bg-surface:  #FFFFFF;  /* cards, tables, sheets    → bg-bg-surface  */
--bg-subtle:   #F4F4F5;  /* hover rows, inset panels → bg-bg-subtle   */
--line:        #E4E4E7;  /* default hairline         → border-line    */
--line-strong: #8A8A94;  /* input + control edges    → border-line-strong */

--fg-primary:   #18181B;  /* headings, amounts       → text-text-primary   */
--fg-secondary: #52525B;  /* labels, body            → text-text-secondary */
--fg-tertiary:  #6B6B74;  /* meta, placeholders      → text-text-tertiary  */
--fg-on-accent: #FFFFFF;  /* text on a filled accent → text-text-on-accent */

/* Accent — indigo/violet */
--accent-base:         #6366F1;  /* borders, icons, chart series → accent      */
--accent-hover-base:   #4F46E5;  /*                              → accent-hover */
--accent-pressed-base: #4338CA;  /*                              → accent-pressed */
--accent-subtle-base:  #EEF2FF;  /* selected row, nav pill       → accent-subtle */
--accent-border-base:  #C7D2FE;  /*                              → accent-border */
--focus-ring-base:     #6366F1;  /* 2px ring, 2px offset         → focus-ring */
--accent-solid-base:   #4F46E5;  /* filled buttons bearing white text → accent-solid */
--accent-text-base:    #4F46E5;  /* links and accent text             → accent-text */

/* Semantic — status only, never decoration. TWO shades per status. */
--status-success: #059669;  --status-success-subtle: #ECFDF5;  --status-success-text: #047857;
--status-warning: #CE7008;  --status-warning-subtle: #FFFBEB;  --status-warning-text: #B45309;
--status-danger:  #DC2626;  --status-danger-subtle:  #FEF2F2;  --status-danger-text:  #B91C1C;
--status-info:    #2563EB;  --status-info-subtle:    #EFF6FF;  --status-info-text:    #1D4ED8;
--status-neutral: #71717A;  --status-neutral-subtle: #F4F4F5;  --status-neutral-text: #52525B;
```

**Why accent and status each have two shades.** The brand indigo `#6366F1`
carries white text at 4.47:1 — just under AA — so filled controls and accent
text use `--accent-solid-base` / `--accent-text-base` (`#4F46E5`, 6.29:1 on
white). The brand indigo remains the border, icon and chart colour. The same
split applies to status: `--status-*` is a **fill** (dots, bars, icons,
borders, chart series) and `--status-*-text` is the accessible **foreground**
for text on the matching subtle background.

**Three values changed in the D5.3 contrast pass**, and the originals are
recorded because the reason generalises:

| Token | Was | Now | Why |
|---|---|---|---|
| `--fg-tertiary` | `#A1A1AA` | `#6B6B74` | 2.56:1 on white. The app's most-used meta colour carries real words, so it needs 4.5:1, not the 3:1 a decorative tint would. |
| `--line-strong` | `#D4D4D8` | `#8A8A94` | 1.48:1. This is the border on every input, checkbox and secondary button — WCAG 1.4.11 wants 3:1 for a UI component boundary. |
| `--status-warning` | `#D97706` | `#CE7008` | 2.90:1 as a fill on `--bg-subtle` (the flagged-row edge on a hovered row), against the same 3:1 floor. |

`--line` stays light on purpose: it separates static content (card edges,
table rules), which 1.4.11 does not govern.

**Contrast contract:** enforced, not asserted. `scripts/check-contrast.mjs`
runs in `npm run lint` and measures **every** foreground token against every
surface it lands on — 56 pairs. The hand-written list this section used to
carry is what let `--fg-tertiary` ship at 2.56:1 for five milestones. Status
is **never** communicated by color alone — always color + label, and
shape/icon where space allows.

### 5.2 Status → token map (single source of truth)

Held in code at `lib/design/status.ts` (`STATUS_MAP`) and rendered by exactly
one component, `StatusBadge`. The table below is the same data; the **key**
column is the literal database value, so a caller passes a raw status through
without translating it first.

| Key (DB value) | Tone | Badge label |
|---|---|---|
| `draft` | neutral | Draft |
| `submitted` | info | Submitted |
| `in_review` | info | In review |
| `approved` | success | Approved |
| `rejected` | danger | Rejected |
| `sent_back` | warning | Sent back |
| `partially_reimbursed` | warning | Partly paid |
| `reimbursed` | success (solid dot) | Paid |
| `disbursed` | info | Disbursed |
| `partially_settled` | warning | Partly settled |
| `settled` | success (solid dot) | Settled |
| `flagged` | warning | Flagged |
| `matched` | success | Matched |
| `missing_in_bank` | danger | Not in bank |
| `missing_in_app` | warning | Not in app |
| `open` | info | Open |
| `resolved` | success | Resolved |
| `wont_fix` | neutral | Won't fix |
| `active` | success | Active |
| `invited` | info | Invited |
| `deactivated` | neutral | Deactivated |
| `suspended` | danger | Suspended |

A tone resolves to `bg-status-<tone>-subtle` + `text-status-<tone>-text` for
the chip and `bg-status-<tone>` for the dot — the two-shade split from §5.1.
An unknown key falls back to neutral with the raw value humanised, so a new
status renders legibly before anyone adds a row here.

**Nothing else may colour a status.** `scripts/check-design-tokens.mjs` bans
Tailwind palette classes across all of `app/**` and `components/**`, which is
what stops a screen hand-mapping a state to `bg-green-100` — as six of them
had done before that rule was widened.

### 5.3 Typography

**Inter** (variable, self-hosted via `next/font`), with `font-feature-settings: "tnum" 1, "cv05" 1` on all numeric contexts.

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| Display (amount hero, ledger balance) | 32/38 | 600 | −0.02em |
| H1 page title | 24/32 | 600 | −0.015em |
| H2 section | 18/26 | 600 | −0.01em |
| H3 card title | 15/22 | 600 | 0 |
| Body | 14/22 | 400 | 0 |
| Body strong / table amount | 14/22 | 500–600 | 0, `tnum` |
| Label / caption | 13/18 | 400–500 | 0 |
| Meta / timestamp | 12/16 | 400 | 0.01em |

Rules: max 3 sizes per screen · never bold a label and its value both · all amounts use `tnum` and right alignment in tables · currency symbol at the same weight as the number, never smaller.

### 5.4 Spacing, radius, elevation

- **Space scale (4px base):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Nothing off-scale.
- **Radius:** `sm 6px` (badges, inputs) · `md 8px` (buttons, dropdowns) · `lg 12px` (cards, sheets) · `full` (avatars, pills).
- **Elevation (four levels only):**
  - `flat` — border only, no shadow (cards, tables)
  - `raised` — `0 1px 2px rgb(0 0 0 / 0.05)` (dropdowns, hover cards)
  - `overlay` — `0 8px 24px rgb(0 0 0 / 0.08)` (popovers, command palette)
  - `modal` — `0 16px 48px rgb(0 0 0 / 0.12)` + scrim `rgb(0 0 0 / 0.4)`
- Never combine a strong border with a strong shadow.

### 5.5 Layout

- App shell: fixed left sidebar `240px` (collapsible to `64px` icon rail), content max-width `1280px`, page padding `24px` desktop / `16px` mobile.
- Grid: 12-column, `24px` gutter desktop; single column under `768px`.
- Breakpoints: `sm 640` · `md 768` · `lg 1024` · `xl 1280`.
- Mobile: bottom tab bar (Home · Expenses · Add · Reports · More) replaces sidebar under `md`; center "Add" is the accent FAB-style action.

### 5.6 Motion tokens

```css
--dur-instant: 100ms;  /* hover, focus, color change */
--dur-fast:    150ms;  /* dropdowns, tooltips, checkbox */
--dur-base:    200ms;  /* modals, toasts, tab switches */
--dur-slow:    300ms;  /* sheets, page-level transitions — the ceiling */
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);   /* enters */
--ease-in:     cubic-bezier(0.4, 0, 1, 1);      /* exits */
--spring-soft:  { stiffness: 300, damping: 30 }  /* sheets, drawers */
--spring-snappy:{ stiffness: 500, damping: 35 }  /* toasts, popovers */
```

Library: **Framer Motion** for orchestration, **Sonner** for toasts, **Vaul** for mobile bottom sheets (Emil's own libraries — behavior already matches these principles).

---

## 6. Component Specifications

Built on shadcn/ui, restyled to the tokens above. Each component documents variants, states, and motion.

### 6.1 Core

| Component | Notes |
|---|---|
| **Button** | Variants: primary (filled indigo), secondary (border + white), ghost, destructive, link. Sizes sm/md/lg (32/36/44px). States: default/hover/active/focus-visible/disabled/loading (inline spinner replacing label, width preserved — **no layout shift**). Hover changes background 100ms; active scales to `0.98`. |
| **Input / Select / DatePicker** | 36px height, 1px `--border-strong`, radius sm, focus = 2px accent ring + offset. Label above, helper below, error replaces helper in danger token. Amount input: right-aligned, tabular, currency prefix as static adornment. |
| **AmountInput** | Dedicated component. Accepts pasted "1,234.56" / "₹1234", stores minor units, shows formatted value on blur, raw on focus. Never rounds silently. |
| **Badge / StatusBadge** | One component reading the §5.2 map. Dot + label, subtle bg, sm radius, 12px text. Never invent a status color inline. |
| **Card** | White surface, 1px border, `lg` radius, 20px padding, optional header row (title left, action right). No shadow at rest. |
| **DataTable** | TanStack Table. Sticky header, 48px rows (comfortable), hover `--bg-subtle`, selected `--accent-subtle` + left 2px accent bar. Amounts right-aligned tabular. Column visibility menu, server pagination past 50 rows. Under `md` collapses to stacked cards (amount + merchant primary, meta secondary). |
| **Sheet / Dialog** | Desktop dialog: scale 0.96→1 + fade, 200ms ease-out, scrim fade. Mobile: Vaul bottom sheet with drag-to-dismiss, spring-soft. Focus trapped, Esc closes, scroll locked. |
| **Toast (Sonner)** | Bottom-right desktop / top mobile. Success, error, and "Undo" variants. 4s auto-dismiss, pause on hover, stack max 3, spring-snappy entry from edge. |
| **Tabs / Segmented control** | Active indicator uses shared layout animation (slides between tabs, 200ms) — never a hard jump. |
| **Command palette (⌘K)** | Actions + navigation + expense search. Overlay elevation, 150ms fade + 0.98→1 scale. |
| **EmptyState** | Geometric mark (thin-stroke icon in a 48px `--bg-subtle` circle), one-line headline, one-line explanation, single primary action. Never an apologetic paragraph. |
| **Skeleton** | Shape-matched blocks in `--bg-subtle`, subtle opacity pulse (1.6s). Used only where content is genuinely pending; instant content preferred. |

### 6.2 Domain components

| Component | Purpose |
|---|---|
| **ReceiptDropzone** | Drag-and-drop + camera on mobile. Dashed `--accent-border` on drag-over with 100ms fill of `--accent-subtle`. Thumbnail grid with remove; PDF shows page-1 preview. |
| **OCRReviewCard** | Shows extracted merchant/date/amount as editable fields with a subtle "extracted" chip; low-confidence fields get warning-token underline. Confirm is the single primary action. |
| **PolicyFlagChip** | Warning token, tooltip with rule text. Appears with a 150ms fade — **never blocks** or shakes the form. |
| **ApprovalRow** | Approver queue: avatar, employee, amount (hero), flags, date, inline Approve / Send back / Open. Approve triggers optimistic row exit (fade + collapse height, 200ms) with Undo toast. |
| **LedgerTable** | Tally-style: date, particulars, debit, credit, running balance. Balance column bold tabular, negative in danger token. Sticky totals footer. Print stylesheet included. |
| **ReconcileBuckets** | Three-column board (Matched / Not in bank / Not in app) with counts; drag-free — actions are explicit buttons. Colors from §5.2. |
| **PaymentProofViewer** | Lightbox for proof images/PDFs, zoom, download, metadata sidebar (method, UTR, date, payer). |
| **StatCard** | KPI: label (13px secondary), value (32px display, tabular), delta chip (success/danger + arrow), optional sparkline. Numbers animate in only on first mount, ≤400ms, respecting reduced-motion. |
| **Charts (Recharts)** | Single accent for primary series; categorical palette = accent + 4 desaturated neutrals-with-hue, never rainbow. Grid `--border` at 50% opacity, no chart junk, tooltips match Card styling. Draw-in animation 300ms on mount only. |

---

## 7. Key Screen Specs

### 7.1 Add Expense (mobile-first — the most important screen)
Single column, thumb-reachable. Order: **receipt capture → amount → merchant → category → date → project/purpose**. Amount uses a large display-size input with numeric keypad. OCR fills fields with a "review extracted" chip. Policy flags appear inline below the offending field as warning chips. Sticky bottom bar: "Save draft" (ghost) + "Add to report" (primary). Nothing else on screen competes.

### 7.2 My Expenses
Filter bar (search, date range, status, category) collapses to a single "Filters" sheet on mobile with an active-count badge. Table desktop / cards mobile. Bulk select → floating action bar slides up (200ms ease-out) with "Add to report".

### 7.3 Approval Queue
Flagged items sorted first with a warning left-edge accent. Each row shows enough to decide without opening: employee, amount, category, flags, age. Bulk approve only enabled when selection contains no flagged items — button label explains why when disabled. Every approval is optimistic + undoable for 5 seconds.

### 7.4 Finance Dashboard
Four StatCards (total spend, pending approvals, awaiting reimbursement, **outstanding to employees**), then spend trend chart, then category breakdown + top spenders. Filters persist in the URL. Every KPI clicks through to its filtered table — the number and the list must always agree.

### 7.5 Ledger (Tally view)
Dense but airy: monospace-feel via tabular Inter, alternating row treatment via `--bg-subtle` at 40%, sticky header and totals. Entity switcher (user / project / department) as a segmented control. Export menu: CSV · Tally XML · Print.

### 7.6 Reconciliation
Import wizard as a 3-step sheet (upload → map columns → review), with a live 5-row preview during mapping. Results as three labeled buckets with counts and a summary strip showing matched %. Unexplained amounts always shown in the danger token.

### 7.7 Complaints
Thread layout like a support conversation: original complaint card, then messages, composer pinned bottom. SLA badge in the header (green/amber/red). Resolve opens a dialog demanding a resolution note.

---

## 8. Accessibility Requirements (non-negotiable)

- Contrast ≥4.5:1 body, ≥3:1 large text and UI boundaries — CI check via automated axe run.
- Every interactive element reachable and operable by keyboard; visible focus ring always (never `outline: none` without replacement).
- Touch targets ≥44×44px (comfortable density already satisfies this).
- Status conveyed by label + color, never color alone; charts get patterns or direct labels.
- Forms: label bound to input, errors announced via `aria-live`, error text references the field by name.
- Dialogs and sheets: focus trap, restore focus on close, `aria-modal`, Esc to dismiss.
- `prefers-reduced-motion`: transforms and springs disabled, opacity fades retained, no parallax or auto-playing motion.
- Screen-reader pass on the three critical flows: submit expense, approve report, mark reimbursed.

## 9. Success Metrics

| Metric | Target |
|---|---|
| Median time to submit an expense on mobile | < 60s |
| Lighthouse Accessibility (all key routes) | ≥ 95 |
| Lighthouse Performance (dashboard) | ≥ 90 |
| Cumulative Layout Shift | < 0.05 |
| Interaction to Next Paint | < 200ms |
| Components using raw hex instead of tokens | 0 (lint-enforced) |
| Approver actions completed without opening detail view | > 70% |

## 10. Open Questions

| # | Question | Owner |
|---|---|---|
| 1 | Per-tenant branding beyond logo (accent override)? Affects token architecture | Product |
| 2 | Dark mode timeline — tokens support it, but do we commit to shipping it? | Product |
| 3 | Do finance users want a compact-density toggle after using comfortable for a month? | Research (post-launch) |
| 4 | ~~Print/PDF styling for ledger and reports — browser print CSS or server-rendered PDF?~~ **Answered 2026-08-23:** both, for different jobs. On-screen documents print through `@media print` in `app/globals.css` (real layout: repeating table headers, totals last, `break-inside: avoid`). The emailed monthly summary uses a dependency-free writer at `lib/exports/pdf.ts` — a headless browser to render six numbers would mean shipping ~300 MB of Chromium in a cron route. That writer is text-only and single-page **on purpose**; anything needing a chart or page breaks should take a real PDF library rather than growing it. | Engineering |

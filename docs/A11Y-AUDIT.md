# Accessibility audit — WCAG 2.1 AA

**D5.3.** What was checked, what was found, what was fixed, and — set out
plainly — what has **not** been verified and why.

## Summary

| | |
|---|---|
| **Standard** | WCAG 2.1 Level AA |
| **Issues found** | 6 |
| **Critical** | 2 · **Major** | 3 · **Minor** | 1 |
| **Remaining** | 0 code issues; 3 verification gaps (below) |

Every issue below was found by reading the codebase or by computing contrast
from the token source. None was theoretical — each is a specific line that
shipped.

---

## Findings

### Perceivable

| # | Issue | Criterion | Severity | Fix |
|---|---|---|---|---|
| 1 | `--fg-tertiary` was `#A1A1AA` — **2.56:1** on white, 2.33:1 on `bg-subtle`. The app's most-used meta colour: timestamps, hints, counts, column sub-labels, chart axis labels. | 1.4.3 | 🔴 Critical | Darkened to `#6B6B74` (5.28 / 5.05 / 4.80 across the three surfaces). Still a clear step below `--fg-secondary`, so the hierarchy survives. |
| 2 | `--line-strong` was `#D4D4D8` — **1.48:1** on white. This is the border on every input, checkbox and secondary button. | 1.4.11 | 🔴 Critical | Darkened to `#8A8A94` (3.42:1). `--line` stays light on purpose: it separates static content (card edges, table rules), which 1.4.11 does not govern. |
| 3 | `--status-warning` `#D97706` measured **2.90:1** on `bg-subtle` — the flagged-row edge on a hovered row. | 1.4.11 | 🟢 Minor | Nudged to `#CE7008` (3.21:1). Small enough to keep the PRD's amber. |
| 4 | 25 call sites used `text-destructive`, a shadcn compat token in `oklch` that was never measured against the app's surfaces — and every one of them was an **error message**. | 1.4.3 | 🟡 Major | All replaced with `text-status-danger-text` (`#B91C1C`, 6.47:1 on white), which the contrast checker covers. |

### Robust

| # | Issue | Criterion | Severity | Fix |
|---|---|---|---|---|
| 5 | `StatusBadge` and `SlaBadge` carried `role="status"` — an **aria-live region**. A 50-row table therefore contained 50 live regions, and every filter change or re-render fired a burst of announcements over whatever the user was reading. | 4.1.2 / 4.1.3 | 🟡 Major | Role removed. The label is visible text a screen reader reads in place; an `sr-only` "Status: " / "Service level: " prefix supplies the word the colour carries visually. |
| 6 | `text-text-inverse` was used on the wizard step indicators in two files. **That class does not exist** — the token is `--color-text-on-accent` — so the glyphs inherited the ambient colour on a filled indigo circle. | 1.4.3 | 🟡 Major | Corrected to `text-text-on-accent`. The **active** step also moved from `bg-accent` to `bg-accent-solid`, because it carries a numeral and white on the brand indigo is 4.47:1 — a hair under AA for text. |

### Operable

| # | Issue | Criterion | Severity | Fix |
|---|---|---|---|---|
| 7 | The command palette's search input (`components/shell/command-palette.tsx`) carried `outline-none` with **no focus style on it or its container** — the one `outline-none` site of 38 that was never paired with a ring. `autoFocus` masked it on open, so the field looked focused the only time most people looked at it; Shift+Tab back from the results list left no visible focus anywhere on screen. | 2.4.7 | 🟡 Major | `focus-within:ring-2 ring-focus-ring` on the container, the same pattern `AmountInput` uses. `ring-inset` rather than an offset ring: the row sits flush against the dialog's rounded top edge, where an outward ring is clipped by the overflow. |

---

## Colour contrast

Verified by `scripts/check-contrast.mjs`, which reads the tokens straight out
of `app/globals.css` and checks **every** foreground against **every** surface
it is placed on. It runs in `npm run lint`.

This replaces a hand-written `CONTRAST_CONTRACT` list that only covered pairs
somebody remembered to add — which is exactly how findings 1 and 2 survived
five milestones.

**56 pairs, all passing.** The tight ones:

| Pair | Ratio | Required |
|---|---|---|
| `text-tertiary` on `bg-subtle` | 4.80:1 | 4.5:1 |
| `status-warning-text` on `bg-subtle` | 4.57:1 | 4.5:1 |
| `status-warning` (fill) on `bg-subtle` | 3.21:1 | 3:1 |
| `line-strong` on `bg-surface` | 3.42:1 | 3:1 |
| white on `status-success` (check glyph) | 3.77:1 | 3:1 (non-text) |

Full table: `node scripts/check-contrast.mjs --table`.

### Status is never colour alone

Checked at every site that conveys state:

- `StatusBadge` — coloured dot **plus** the status word. The dot is
  `aria-hidden`; the word is the accessible name.
- `SlaBadge` — the label spells out "3 of 5 business days" / "SLA breached".
- Reconciliation buckets — tone **plus** a heading and a count chip.
- Policy flags — warning tint **plus** the rule text, in a tooltip reachable
  by keyboard.
- Delta chips on KPIs — colour **plus** an arrow glyph, so direction survives
  greyscale.
- Overdue complaint rows — the danger edge is redundant with the SLA badge in
  its own column.
- Chart series — five hues that also differ in position and carry a data
  table (below).

---

## Charts

Already compliant before this audit; verified rather than changed.

`ChartFrame` wraps every chart in `role="img"` with an `aria-label` carrying a
plain-language summary generated by `describeSeries` — "Spend by category:
Travel ₹52,400, Meals ₹29,800, …". Beneath it, a **"Show data" toggle** reveals
a real `<table>` with `<caption>`, `scope="col"` headers and amounts rendered
through `<Amount>`.

So a chart is available three ways: visually, as a spoken summary, and as
tabular data.

---

## Automated checks (axe-core)

`tests/e2e/a11y.spec.ts` runs `@axe-core/playwright` against **34 routes plus
2 overlays** — 36 scans: 2 public (`/login`, `/signup`) and 32 authenticated —
tagged `wcag2a wcag2aa wcag21a wcag21aa`. Run with
`npm run test:a11y`; CI fails on any violation, and the reporter prints each
violation's impact, rule, help URL and the failing selectors.

The suite provisions its own org and files an expense first, so authenticated
routes are scanned **with rows in them** — scanning an empty state would pass
while saying nothing about the table, badges and amounts a working screen
renders. Overlays are opened and scanned in their open state, because a sheet
is a different DOM than the page behind it.

One rule is disabled, with a reason: **`color-contrast`**. It is checked
exhaustively and deterministically by `scripts/check-contrast.mjs` against the
token source, which covers pairs no rendered page happens to show; axe
re-checks the same thing against antialiased pixels and disagrees at sub-pixel
edges.

> **axe catches roughly a third of real accessibility problems.** It finds
> missing names, bad roles, orphaned labels, duplicate ids, landmark
> structure. It cannot tell you whether the focus order makes sense, whether
> a screen reader's narration is comprehensible, or whether a keyboard user
> can finish a task. See the gaps below.

---

## Keyboard operability — **static review, not a live walkthrough**

The three critical flows were reviewed by reading every interactive component
in their path. This found no defects, and that finding is **weaker than a real
walkthrough** — see the gaps section.

| Concern | Basis | Result |
|---|---|---|
| Dialogs trap focus, restore it, close on Esc | All dialogs are Radix `Dialog`; the behaviour is the primitive's, not hand-rolled | ✅ by construction |
| Sheets trap focus, close on Esc | All sheets are Vaul `Drawer` | ✅ by construction |
| Popovers/menus close on Esc, return focus | All are Radix `Popover` | ✅ by construction |
| Visible focus ring everywhere | `focus-visible:ring-2 ring-focus-ring ring-offset-2` on every interactive class; ring measures 4.47:1 on surface (needs 3:1). The one gap — the command palette's bare input — is finding 7 above, now fixed | ✅ |
| No positive `tabindex` | Grepped: none in `app/**` or `components/**` | ✅ |
| Confirm button never takes initial focus | `ConfirmDestructiveDialog` puts Cancel first in the DOM and sets `autoFocus={false}` on confirm | ✅ |
| Skip link | `AppShell` renders "Skip to content" as the first focusable element | ✅ |
| Card pickers are real radios | Complaint type cards wrap `<input type="radio" className="sr-only">`, so arrow keys and form semantics come free | ✅ |
| Touch targets ≥44px | `sm`/`md` buttons carry a transparent `after:` tap extension to 44px; nav items are `h-11` | ✅ |

---

## Screen reader — **static review, not a live pass**

| Concern | Basis | Result |
|---|---|---|
| Form labels | Every input is inside a `<label>` or wired through `FormField`/`FormLabel` | ✅ |
| Errors announced | Inline errors carry `role="alert"`; the amount input's rounding refusal uses `role="status" aria-live="polite"` | ✅ |
| Status badges readable | Fixed — see finding 5 | ✅ |
| Table headers | Every `<th>` in the app now has `scope="col"` — **fixed in 4 hand-rolled tables** (analytics, categories, users, super) that had none; `DataTable`, `LedgerTable`, `ChartFrame` already did | ✅ |
| Actions column has a name | `/super`'s unlabelled `<th />` now carries an `sr-only` "Actions" | ✅ |
| Icon-only buttons named | Sidebar toggle, `MaskedValue` reveal, attachment remove all carry `aria-label`; no unnamed icon button found | ✅ |
| Decorative icons hidden | `aria-hidden="true"` on every lucide glyph beside a text label | ✅ |
| Landmarks | `AppShell` renders `<main id="main-content">`; nav elements carry `aria-label` | ✅ |

---

## Verification gaps

Three things the DoD asks for could **not** be done in this environment. They
are listed rather than glossed, because an audit that quietly implies coverage
it doesn't have is worse than one that admits the hole.

### 1. The axe suite has not been executed

The spec is written, wired to `npm run test:a11y`, and typechecks. Running it
needs a dev server, and on this machine Next dies with
`RangeError: Array buffer allocation failed` before serving a page — a memory
limit, not a code fault. Retried with `--max-old-space-size=4096`; same result.

**The suite is therefore unproven.** Expect the first real run to surface
findings — that is what it is for. It should be run before this milestone is
called done.

**Update (2026-08-23).** Still unexecuted, but three things changed:

1. **CI now runs it** (G4). `.github/workflows/ci.yml` installs Chromium and
   invokes `test:e2e` and `test:a11y` after the isolation suite, uploading the
   Playwright report on failure. Neither suite had ever been invoked by any
   workflow, so the first pipeline after this commit is where they will run for
   the first time — and it is expected to go red.
2. **Its route coverage was a third short.** The spec scanned 18 routes; the
   app serves 29 without an id. Unscanned were `/card-imports`,
   `/settings/whatsapp`, `/recurring`, `/reports/new`, `/analytics/violations`,
   `/settings`, `/settings/approval-chains`, `/settings/clients`,
   `/settings/delegations`, `/settings/email-ingestion` and
   `/settings/categories/new` — three of them edited in the two commits before
   this one. All 29 are now in the list. A suite that never visits a route
   reports zero violations for it, and zero reads exactly like a pass.
3. **A unit test now guards that coverage.** `tests/unit/a11y-coverage.test.ts`
   walks the real route tree and fails `npm run test` when a route exists that
   the spec never visits, when the spec names a route that no longer exists, or
   when an exclusion has no stated reason. It needs no browser, so it holds
   while everything else here is blocked.

**Update (2026-09-02) — the scan has now run, and is green.** After the
dependency-tree repair in `docs/VERIFICATION-RUNBOOK.md` §0, CI executed the
suite for the first time on 2026-08-31 and it has passed on every push since
(run 33608277717 on master, 2026-09-02). The first real run surfaced exactly one
finding, a critical `role="tablist"` with non-tab children on the scope switch,
now a radiogroup — recorded in `docs/PRODUCTION-CHECKLIST.md`. Lighthouse's
accessibility category scores **100** on both public routes (`docs/lh-login.json`,
`docs/lh-signup.json`). Gaps 2 and 3 below are still open.

The dynamic routes remain unscanned — `/expenses/[id]`, `/reports/[id]`,
`/approvals/[id]`, `/complaints/[id]`, `/settings/users/[id]`,
`/settings/categories/[id]`. They need an id captured during setup, and they are
where `StatusBadge`, the report timeline and the decision panel actually render,
so they are the most valuable ones still missing.

### 2. No live keyboard walkthrough

No browser has been connected in any session of this build. The keyboard table
above is a code review: it establishes that the *mechanisms* are right (Radix
and Vaul own focus management; the ring is on every interactive class) but not
that the *experience* is. Focus order in the payment-run sheet and the
approval queue's optimistic row removal are the two places I would look first.

### 3. No screen-reader pass, and no Lighthouse score

VoiceOver/NVDA and Lighthouse both need a browser. The Lighthouse target
(≥95) is unmeasured. The code-level inputs to that score — labels, names,
roles, contrast, landmarks — are all addressed above, which is a reason to
expect a good score and not a substitute for having one.

---

## Keeping it true

| Check | Runs in | Catches |
|---|---|---|
| `scripts/check-contrast.mjs` | `npm run lint` | Any token pair below 4.5:1 (text) or 3:1 (UI) |
| `tests/e2e/a11y.spec.ts` | `npm run test:a11y` | axe violations on 34 routes + 2 overlays |
| `tests/unit/a11y-coverage.test.ts` | `npm run test` | A route the spec above never scans — no browser needed |
| `tests/unit/design-tokens.test.ts` | `npm run test` | The hand-written contract, now including `text-tertiary` |

The contrast script is the one that matters most here: findings 1 and 2 were
both invisible to a hand-maintained list, and both were in the app's most
common colours.

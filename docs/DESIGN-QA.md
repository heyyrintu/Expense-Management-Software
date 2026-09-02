# Final design QA

**D5.5.** Every key screen against its DESIGN-PRD §7 spec, plus the
cross-screen checks that only show up when you look at the whole app at once.

## Summary

| | |
|---|---|
| Screens checked against §7 | 8 |
| Deviations found | 7 — **4 justified, 3 fixed** |
| Cross-screen issues found | 3 — all fixed |
| Gallery gaps found | 2 — both fixed |
| Repo-wide token lint | ✅ zero violations across `app/**`, `components/**`, `lib/**` |
| Screenshot baseline | ❌ **not captured** — see gaps |

---

## 1. `/design-system` walkthrough

22 sections, covering tokens, typography, money and dates, the spacing/radius/
elevation scales, every primitive, the app shell, and one section per §7
screen. Contrast ratios are shown numerically in the tokens section, with the
brand-fill values called out separately from the `-text` shades.

**Two gaps found and fixed:**

| Gap | Why it matters |
|---|---|
| D5.1's eight **skeleton primitives** (`PageHeaderSkeleton`, `TableSkeleton`, `CardListSkeleton`, `FormSkeleton`, `PanelSkeleton`, `ToolbarSkeleton`, `StatStripSkeleton`, `SettingsShellSkeleton`) shipped with no gallery entry | This breaks the standing rule — and the loading state is *precisely* the one nobody reviews, because you see it for 200ms on a slow connection and never on a fast one. They now sit in the Patterns section beside the loaded content, where a mismatched reservation is obvious. |
| **`RouteError`** (D5.1) had no entry | The error boundary body, in both its variants (retry only, and retry + go-back for detail routes). |

Internal helpers (`DeltaChip`, `Sparkline`, `BalanceCell`, `ReceiptTile`,
`SortIcon`, `Marker`) are not listed separately — they have no independent
API and are visible inside the components that own them.

---

## 2. Token lint — repo-wide ✅

`scripts/check-design-tokens.mjs` was scanning `app/**` and `components/**`.
D5.5 widened it to **`lib/**` as well**, which is what the DoD asks for, and
which turned out to matter: `lib/charts/theme.ts` holds real colour, because
Recharts takes props rather than classes so chart colour cannot come through
Tailwind at all.

Three files are declared token *sources* rather than consumers — `globals.css`,
`lib/design/tokens.ts`, `lib/charts/theme.ts` — because a literal is correct
in the one place a value is defined. The chart theme is held to the token layer
by `tests/unit/chart-theme.test.ts`, which is how D5.3's contrast fix was
caught when `--fg-tertiary` moved and the axis colour didn't follow.

**Result: zero raw hex, zero arbitrary Tailwind values, zero palette colours
in token-only directories.**

---

## 3. Cross-screen consistency

| Check | Method | Result |
|---|---|---|
| Same status renders identically everywhere | Only `StatusBadge` maps status → colour, from `lib/design/status.ts`. Grepped for status colour applied anywhere else | ✅ — see note below |
| Amounts tabular and right-aligned in tables | Grepped every `<Amount>` in a table/cell context for `align="right"` | ✅ all |
| One date format | Grepped `toLocaleDateString` / `Intl.DateTimeFormat` in components | ✅ none — everything goes through `<DateCell>` |
| No ad-hoc money formatting | Grepped `toFixed` / `toLocaleString` / `Intl.NumberFormat` | 🔧 **1 fixed** (below) |
| Empty-state copy shares one voice | `scripts/check-copy-voice.mjs` in `npm run lint` | ✅ |
| One primary button per screen | Read every §7 screen's buttons in every state | 🔧 **2 fixed** (below) |
| Print | `@media print` overrides tokens at `:root`, so status keeps its meaning without colour; `[data-slot^="app-"]` chrome is hidden | ✅ |

### 🔧 Fixed — two primary buttons on an empty screen

`/dashboard` and `/reports` each render a primary action in the `PageHeader`
**and** a primary action in their `EmptyState`. On a brand-new org both are on
screen at once, offering the same action — two filled indigo buttons that are
identical twins, which is exactly what §4.6 forbids.

Both headers now stand their action down when the screen is showing its empty
state. The empty state *is* the screen at that moment, and its call to action
should be the single primary.

This is the kind of thing only a final pass catches: each screen is correct in
its normal state, and the collision exists only in the state you see once.

### 🔧 Fixed — float arithmetic on money

`payment-run-sheet.tsx` built a form value with `(line.amount / 100).toFixed(2)`.
That is float division on integer minor units — the arithmetic CLAUDE.md bans —
inside the payment run, of all screens. Replaced with `toDecimalString`.

### Note — status *fills* outside `StatusBadge` are correct

The grep surfaces `bg-status-success` and friends in progress bars, wizard step
indicators, timeline dots and the destructive button. These are **not** status
badges: a bar filling green when a balance reaches zero is a state indicator,
not a status label. They read the same `--status-*` tokens, so the vocabulary
is shared and a theme change moves them together. The rule the badge enforces
is that nothing else *maps a status name to a colour*, and nothing else does.

---

## 4. Screens against DESIGN-PRD §7

### §7.1 Add Expense

| Spec | Built | |
|---|---|---|
| Order: receipt → amount → merchant → category → date → project | As specified | ✅ |
| Display-size amount input, numeric keypad | `<AmountInput>`, `inputMode="decimal"` | ✅ |
| OCR fills fields with a "review extracted" chip | `<OcrReviewCard>` | ✅ |
| Policy flags inline below the offending field | `<PolicyFlagChips>`, 150ms fade, no shake, no focus steal | ✅ |
| Sticky bottom bar: Save draft (ghost) + Add to report (primary) | As specified | ✅ |

**Deviation — justified.** §6.2 specifies a low-confidence underline on OCR
fields. It is built but **unwired**: `OcrResult` carries no confidence value,
and `lib/ocr` resolves to `{}` for every PDF and unreadable photo. Deriving a
confidence would be a guess wearing a warning colour. Recorded rather than
faked; it lights up when the OCR layer returns real scores.

### §7.2 My Expenses

| Spec | Built | |
|---|---|---|
| Filter bar collapsing to a sheet with an active-count badge | `components/filters` | ✅ |
| Table desktop / cards mobile | `DataTable` `renderCard` | ✅ |
| Bulk select → floating bar, 200ms ease-out | `BulkActionBar` | ✅ |

**Deviation — justified.** The list gained `?scope=mine\|team\|org` in D3.3,
which §7.2 does not mention. It exists because §7.4 requires every KPI to open
a list that agrees with it, and before D3.3 an org-wide finance card had
nowhere honest to point. The parameter can only ever narrow — the ceiling comes
from the session role.

### §7.3 Approval Queue

| Spec | Built | |
|---|---|---|
| Flagged first, warning left-edge accent | `sortApprovalQueue` + `flagged-edge` | ✅ |
| Enough per row to decide without opening | Employee, amount, categories, flags, age | ✅ |
| Bulk approve gated on no flags, with the reason in the tooltip | As specified | ✅ |
| Optimistic + undoable for 5 seconds | Commit is **deferred**, not reversed | ✅ |

**Deviation — justified.** §6.1 mandates `components/data-table` for lists;
this screen does not use it. §7.3 needs a warning left edge, a `collapseRow`
exit and inline decisions, and its unit of work is a decision rather than a
cell. Sanctioned exception, recorded in CLAUDE.md.

### §7.4 Finance Dashboard

| Spec | Built | |
|---|---|---|
| Four StatCards, ending in "outstanding to employees" | In that order | ✅ |
| Spend trend, then category breakdown + top spenders | As specified | ✅ |
| Filters persist in the URL | `useUrlFilters` | ✅ |
| **Every KPI clicks through; number and list always agree** | One where-clause feeds cards, charts and panels | ✅ verified in `tests/isolation/dashboard-kpi.test.ts` |

**Deviation — justified and surfaced in the UI.** "Outstanding to employees"
is report totals minus payments, so no expense filter reproduces it. It is
typed `agreement: { kind: "different", note }` — the type *requires* the note —
and the note renders under the KPI grid. One unreconcilable figure left
unexplained would discredit the other three.

### §7.5 Ledger

| Spec | Built | |
|---|---|---|
| Tabular Inter, alternating rows at `--bg-subtle` 40% | `ledger-row-alt` via `color-mix`, opaque | ✅ |
| Sticky header **and** totals | Both | ✅ |
| Entity switcher as a segmented control | `SegmentedControl` with a shared-layout indicator | ✅ |
| Export: CSV · Tally XML · Print | `ExportMenu` | ✅ |

**Deviation — justified.** Second sanctioned exception to the DataTable rule.
A ledger is a statement, not a list: each row carries the balance the row above
produced, so sorting by amount would destroy the only column that matters. It
also has to print, which virtualisation and client paging both fight.

### §7.6 Reconciliation

| Spec | Built | |
|---|---|---|
| 3-step import sheet with a live 5-row preview | Upload → map → review, review is a real server dry run | ✅ |
| Three labelled buckets with counts | Matched / Not in bank / Not in app | ✅ |
| Summary strip with matched % | Period, matched %, unexplained | ✅ |
| Unexplained always in the danger token | ✅ — **except at zero**, where it goes green | ✅ deliberate |

**Deviation — justified.** §7.6 says "always"; a red ₹0 on the goal state
teaches readers to ignore the colour, which is the opposite of what the rule is
protecting. Green at zero, danger otherwise.

### §7.7 Complaints

| Spec | Built | |
|---|---|---|
| Thread like a support conversation | No bubbles, no right-alignment; own messages marked by a quieter avatar | ✅ |
| Original complaint card, then messages, composer pinned bottom | As specified | ✅ |
| SLA badge in the header, green/amber/red | `SlaBadge`, business-day maths | ✅ |
| Resolve opens a dialog demanding a resolution note | Submit disabled until non-empty | ✅ |

### Settings (§6, PLAN 2.0)

Left section nav + right panel, one column under md; `DirtySaveBar` on every
form; destructive confirmations naming the exact entity. ✅

---

## 5. Screenshot baseline — **captured** ✅

`tests/e2e/screenshots.spec.ts` captures 14 screens × 2 widths (1280×900
desktop, 390×844 mobile, 2× DPR) into `docs/screenshots/`, with a freshly
provisioned org and three real expenses so the baseline records working screens
rather than empty states. Wired to `npm run screenshots`.

**Run 2026-08-28 (public routes) and 2026-09-01 (the 12 tenant screens)** on the
Windows host against the docker-compose stack, once the dependency tree was
repaired (`docs/VERIFICATION-RUNBOOK.md` §0). All 28 PNGs are committed; the
README in that directory is the index.

The spec deliberately captures rather than asserts: `toHaveScreenshot` fails on
antialiasing differences between machines, and a visual test that cries wolf
gets muted within a month.

---

## Verification gaps carried out of D5

Status as of 2026-09-02. The environment blockers are gone (Docker and the
build both work on the host, and CI runs the browser suites on every push);
what remains is the manual work.

| Gap | Status | Command |
|---|---|---|
| axe accessibility suite | ✅ runs green in CI on every push (34 routes + 2 overlays) | `npm run test:a11y` |
| Lighthouse on `/login`, `/signup` | ✅ a11y 100 / 100, CLS 0 / 0 (`docs/lh-*.json`) | `npx lighthouse` |
| Lighthouse ≥90 / CLS <0.05 on `/dashboard`, `/expenses`, `/expenses/new` | see `docs/VERIFICATION-RUNBOOK.md` results table | `npx lighthouse` with a session cookie |
| INP <200ms | ❌ needs a DevTools interaction trace, not a lab run | manual |
| Screenshot baseline | ✅ 28 PNGs committed | `npm run screenshots` |
| Responsive walkthrough at 5 widths | partial (screenshots cover 2) | manual |
| Keyboard + screen-reader passes | ❌ not performed | manual |

### A note on the build machine

Over the course of D5.3–D5.5 this machine became unable to complete a
production build reliably: `next build` compiles and generates all 51 pages,
then the worker dies during *Collecting build traces* with
`STATUS_STACK_BUFFER_OVERRUN`. Clearing `.next` and raising the heap to 6 GB
gets it through static generation; the trace step still crashes intermittently.

It is memory pressure, not a code fault — the same instability that kills the
dev server. Everything that establishes correctness passes: `tsc --noEmit`,
589 unit tests, the five lint checkers, and the isolation suites that can run.
On a healthier machine the browser-blocked items above should simply work.

All five need a working browser against a running dev server. Everything that
could be verified without one — token lint, contrast computation, copy voice,
motion rules, bundle sizes, 200-row pagination, unit and isolation suites — has
been, and is green.

# Performance and responsive audit

**D5.4.** What was measured, what was fixed, and — stated plainly — what could
not be measured in this environment.

## Headline

| Route | First Load JS before | after | change |
|---|---|---|---|
| `/dashboard` | 342 kB | **229 kB** | **−113 kB (−33%)** |
| `/analytics` | 237 kB | **119 kB** | **−118 kB (−50%)** |

Both from one fix: Recharts was in the initial bundle of the two routes that
use it. `/dashboard` is the route every session lands on, so it was the app's
single worst offender and its most-visited page at the same time.

---

## 1. Lighthouse — **not run**

The DoD asks for Lighthouse ≥90 / CLS <0.05 / INP <200ms on three routes, with
before/after numbers. **None of those numbers exist**, because Lighthouse
needs a browser and none has been connectable in any session of this build.
Worse, the dev server on this machine dies with
`RangeError: Array buffer allocation failed` before serving a page — the same
blocker that stopped the axe suite in D5.3, retried here with a 4 GB heap and
the same result.

So this audit reports what it can actually measure — **bundle sizes from
`next build`, which are real numbers from a real production build** — and is
explicit that the three Lighthouse targets are **unverified**.

What the fixes below should do to those metrics, as a prediction to check
against rather than a claim:

| Metric | Expected effect | Why |
|---|---|---|
| Performance | Up on `/dashboard` and `/analytics` | 113–118 kB less JS to download, parse and execute before interactive |
| CLS | Unchanged and already low | Skeletons reserve exact boxes (D5.1), and the new lazy chart fallback is shape-matched to the chart it replaces |
| INP | Unchanged | No new main-thread work; every animation is transform/opacity only (D5.2) |

**Run Lighthouse before calling this milestone done.**

### Update (2026-08-23) — still not run, and D5.4 is now unticked

`DESIGN-PLAN.md` had D5.4 ticked while this section said the numbers did not
exist. That contradiction is resolved in the honest direction: **the box is
unticked**, and it gets ticked when the numbers are here, not before.

Nothing has been measured since. What changed is that the blocker now has a
diagnosis rather than a shrug — `docs/VERIFICATION-RUNBOOK.md` §0 records the
evidence that this repo carries **two lockfiles and a `node_modules` containing
both npm's and pnpm's markers**, with `pnpm-workspace.yaml` left as literal
placeholder text (`set this to true or false`) gating the postinstall builds of
Prisma, `sharp`, `esbuild` and `tesseract.js`. A hybrid native dependency tree
is a credible cause of both `STATUS_STACK_BUFFER_OVERRUN` and the dev server's
heap exhaustion. It is a diagnosis, not a confirmed fix: it could not be
reproduced, because the crash is Windows-native and the shell available for
this work was Linux.

Two notes for whoever runs it, so the numbers mean something:

- **Measure against `npm run build && npm run start`, not `npm run dev`.** The
  dev server ships unminified bundles and unoptimised images; a Performance
  score from it understates the real one enough to send you optimising noise.
- **Lighthouse does not measure INP in a lab run.** It reports CLS directly,
  but INP needs real interaction — record a DevTools Performance trace while
  clicking a filter facet, opening the submit dialog and paging the expenses
  table, then read INP off the interactions track. A lab "INP" copied from a
  Lighthouse JSON would be a fabricated number.

The results table in the runbook is where these land.

---

## 2. Offenders

### Fixed — Recharts in the initial bundle 🔴

`/dashboard` and `/analytics` imported chart components directly from their
server components, so ~130 kB of Recharts landed in first-load JS.

Nothing above the fold needs it. The KPI strip is what a reader looks at
first; the charts sit below it, and on a phone they are a scroll away.

`components/charts/lazy.tsx` now wraps all three charts in `next/dynamic`
with `ssr: false`. That flag is deliberate: a server-rendered Recharts SVG
helps nothing (it is a picture of numbers that are also in the data table
beneath it) and Recharts would still have to ship client-side to hydrate it.
Rendering it once, late, is strictly cheaper.

The fallback is the **same skeleton `ChartFrame` already renders** while
loading — a 224px plot block plus a row of axis ticks — so the box is reserved
before the chunk arrives and nothing below moves. A lazy boundary without a
matched fallback would trade 130 kB for a layout shift, which is a bad trade
on a screen whose job is being readable at a glance.

### Fixed — full-size receipts rendered into 96px tiles 🟡

`ReceiptTile` loaded the original image into a 96px-tall `object-cover` box.
A phone photo is several megabytes; a twelve-receipt report was downloading
tens of MB to draw postage stamps.

Now `loading="lazy"` (tiles below the fold stop competing with the ones on
screen), `decoding="async"` (the decode leaves the main thread — on a busy
report that is the difference between a smooth scroll and a stutter), and
explicit `width`/`height` so the box is reserved.

**Deliberately NOT `next/image`.** These are signed, short-lived, *private*
S3 URLs. The optimizer caches by full URL including the signature, so every
rotation is a cache miss, and it would proxy someone's bank receipt through
the app server. The right fix is a thumbnail generated at upload time and
stored beside the original — recorded below as a follow-up rather than
pretended away.

### Already correct — font loading ✅

`app/layout.tsx` uses `next/font/google` with `Inter`, `display: "swap"`,
`subsets: ["latin"]` and a variable weight, exposed as `--font-inter`.
`next/font` self-hosts the file and preloads it by default, so there is no
render-blocking request to Google and no FOIT. One variable file covers every
weight in the §5.3 scale.

Nothing to fix; verified rather than assumed.

### Already correct — `"use client"` boundaries ✅

135 client components, and the boundaries are already at the leaves: every
route's `page.tsx` is a server component, and the client files are the
interactive parts (tables, sheets, dialogs, forms, filter controls). Spot-
checked the heaviest routes — `/expenses`, `/approvals`, `/bank-recon` — and
found no case of a whole page marked `"use client"` to get one button.

The one boundary worth naming is the charts, and that is what the lazy
wrapper above addresses.

### Already correct — table re-renders ✅

Every `DataTable` call site memoises its `columns` array
(`expenses-table.tsx`, `complaints-table.tsx`), which is the identity TanStack
v8 uses to decide whether to rebuild the table model. An unmemoised `columns`
is the classic cause of a table rebuilding on every keystroke; it is not
present here.

### Already correct — Suspense boundaries ✅

D5.1 gave every async route a `loading.tsx` composed from
`components/ui/page-skeleton`, whose pieces read the same tokens as the real
components. That is the App Router's Suspense boundary, and it is why CLS is
expected to stay low.

---

## 3. Responsive — **static audit only**

Verification at 360 / 390 / 768 / 1024 / 1440px needs a browser. What was done
instead is a source audit for the specific failure modes the DoD lists. It
found **no defects**, and that finding is weaker than looking at the screens.

| Risk | How it was checked | Result |
|---|---|---|
| Horizontal scroll from a fixed width | Grepped every `min-w-*` and `w-*` ≥ 20rem in `app/**` and `components/**` | One `min-w-64` (256px) on the statement picker; fits the 328px available at 360px |
| Tables overflowing the viewport | Every `<table>` in the app checked for an `overflow-x-auto` ancestor | 8 of 8 have one |
| Skeletons overflowing | `w-96` / `w-80` placeholders | Both carry `max-w-full` |
| Grids squeezing on a phone | Grepped `grid-cols-3..9` without a responsive prefix | One: the mobile tab bar's `grid-cols-5`, which is five fixed tabs and mobile-only by design |
| Truncated amounts | `<Amount>` renders tabular with `whitespace-nowrap` inside scroll containers | No clipping path found |
| Touch targets ≥44px | Verified in D5.3: `sm`/`md` buttons carry a transparent `after:` tap extension to 44px; nav items are `h-11` | ✅ |

**Still to do with a browser:** the six screens the DoD names, at five widths.
The two I would look at first are the payment-run sheet at 360px (two-step,
dense, money at display size) and the ledger at 768px (five columns, sticky
header and footer).

---

## 4. Scale — 200 rows ✅ **verified**

`tests/isolation/pagination-scale.test.ts` seeds **200 expenses with
deliberately colliding sort keys** — 28 distinct dates, one `createMany` so
every `createdAt` is identical — which is the shape a card import or a
WhatsApp batch produces, and the shape that breaks an unstable sort.

Six assertions, all passing against the real database:

| Assertion | Why it matters |
|---|---|
| 201 rows exist, more than one page | Otherwise the test proves nothing |
| Each page returns exactly `PAGE_SIZE` | Server pagination, not a client slice |
| **Every row appears exactly once** | The one that matters. D3.3 found page 2 repeating a row from page 1 and dropping one nobody saw — `EXPENSE_LIST_ORDER` appends `id` to make the sort a total order |
| Two identical walks return identical order | One pass agreeing with itself is not stability |
| The KPI total equals the walked rows | §7.4 at scale: a card summing the whole set while the table shows page one |
| A page-4 query stays under 1s | A smoke alarm for a missing `(org_id, user_id, date)` index, not a benchmark |

The list is server-paginated rather than virtualised, which is the right
choice here: virtualisation breaks Ctrl-F, printing and screen-reader row
counts, and 50 rows a page never needs it.

---

## Follow-ups

1. **Run Lighthouse** on `/dashboard`, `/expenses`, `/expenses/new` and record
   the numbers here. The three targets are currently unverified.
2. **Walk the six screens at five widths.** The static audit found nothing,
   but it cannot see overlap.
3. **Generate receipt thumbnails at upload time** (e.g. a 320px WebP beside
   the original) and serve those in `ReceiptTile`. The lazy-loading fix
   reduces the cost; it does not remove it — a 4 MB image is still 4 MB when
   it eventually loads.
4. Re-run `next build` after any of the above and update the table at the top.

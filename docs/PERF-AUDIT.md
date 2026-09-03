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

## 1. Lighthouse — **run 2026-09-02**

Lighthouse 13.4.1 against `next build && next start` on the Windows host, the
docker-compose database, signed in as the seeded `finance_admin@acme.test`
(the heaviest dashboard variant). Default preset = simulated slow-4G, 4× CPU
slowdown, 412px viewport. Raw reports are in `docs/lh-*.json`.

| Route | Preset | Performance | Accessibility | CLS | LCP | TBT | Script transfer |
|---|---|---|---|---|---|---|---|
| `/login` | mobile | **91** | **100** | **0** | — | — | — |
| `/signup` | mobile | 80 | **100** | **0** | — | — | — |
| `/dashboard` | mobile | **62** ❌ | **100** | **0** | 6.5 s | 320 ms | 608 KB |
| `/expenses` | mobile | **72** ❌ | **100** | **0** | 5.8 s | 40 ms | 508 KB |
| `/expenses/new` | mobile | **72** ❌ | **100** | **0** | 5.4 s | 30 ms | 544 KB |
| `/dashboard` | desktop | **98** ✅ | **100** | 0.002 | 1.0 s | 0 ms | 608 KB |

**What the numbers say.** Accessibility and CLS meet their targets on every
route, and the dashboard is well over 90 on the desktop preset. The three
tenant routes MISS the ≥90 target on the mobile preset, and the reason is one
thing: on a simulated slow-4G link, 500–600 KB of JavaScript takes 3.4 s to
first paint before any of it runs. TTFB is 80–140 ms and TBT is negligible on
two of the three, so the server and the main thread are not the problem;
transfer size is. Lighthouse's own opportunities:

- `unused-javascript`: 161–213 KB estimated savings per route.
- `unminified-javascript`: 70 KB on every route — unexpected in a production
  build; one chunk is shipping unminified and should be identified.

**INP is not in this table** because Lighthouse cannot measure it in a lab
run (see the note below); it still needs a DevTools interaction trace.

The bundle work below is what made the desktop number possible — the numbers
in the Headline table are real, from a real production build.

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

### Update (2026-09-03) — the mobile-preset work

Same command, same machine, same seeded finance-admin session, production
build via `next start`, `--blocked-url-patterns="*kaspersky*"` (see the
correction below). Mobile preset. Runs are noisy on this host — the same
build scored 85 and 99 on consecutive passes — so every figure is the
MEDIAN of the runs listed, and the raw JSON of each median run is committed
as `docs/lh-*.json`.

| Route | Before (2026-09-02) | After (median, n) | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|
| `/dashboard` | 62 | **88** (87, 88, 88, 88, 90; n=5) | 2.0 s | 3.7 s | 41 ms | 0 |
| `/expenses` | 72 | **87** (87, 87, 87; n=3) | 2.0 s | 3.8 s | 28 ms | 0 |
| `/expenses/new` | 72 | **86** (86, 86, 88; n=3) | 2.0 s | 4.0 s | 56 ms | 0 |

Desktop preset on `/dashboard` was 98 before and is not the constraint.
First-load JS: `/dashboard` 237 → 213 kB, `/expenses` 272 → 248,
`/expenses/new` 243 → 242 (the capture form keeps its zod and
react-hook-form). Script a phone downloads on the dashboard: 392 → 296 KB.

**A correction first.** The 2026-09-02 note blamed "70 KB of unminified
JavaScript" in the app. It was not the app: the unminified script was
`gc.kis.v2.scr.kaspersky-labs.com/…/main.js`, 198 KB injected by the
antivirus on the measuring machine into every page, and Lighthouse counted
it against the route. The figures above block it. Anyone measuring on a
machine with an AV browser hook should do the same, or the audit will chase
a bundle that does not exist.

What actually moved the numbers, in the order it was found (bundle sizes
are gzipped, from `ANALYZE=true npm run build` → `.next/analyze/client.json`,
now wired into `next.config.ts`):

1. **framer-motion's full runtime (39 KB) on every route — TRIED, REVERTED.**
   Components import `motion.div`, which carries every animation feature
   inline; the textbook fix is `m.div` plus `LazyMotion` loading `domMax`
   (needed for the `layoutId` indicators) as a 27 KB chunk after hydration,
   leaving ~22 KB of `m` core in the initial bundle. It was built, measured
   (dashboard median 92) and reverted, for two reasons that do not depend on
   tuning. First, `m` elements render at their `initial` style until the
   feature chunk lands, and almost every animated element in this app is an
   overlay whose initial state is hidden (`fadeScale` menus, the dialog, the
   bulk bar, policy chips) — on a slow connection a menu opened in that
   window is invisible, which is the "stuck state" the motion rules forbid.
   Second, applying the loaded features is a root-level context change, and
   React's rule for a context change reaching a streamed Suspense boundary
   that is still pending is to discard its server HTML and client-render it:
   the login form existed twice for ~200 ms in about half of all loads
   (0 of 12 on master, 5 of 12 with LazyMotion, measured with a 25 ms DOM
   sampler), and the e2e sign-in, which locates the Organization field in
   strict mode, failed on the pair. Wrapping the update in `startTransition`
   did not change it, because the boundary has nothing to hydrate yet. The
   rule now lives in CLAUDE.md's motion section. Net: 16 KB gzipped left on
   the table, on purpose.
2. **zod was on the dashboard — 25 KB — for a URL parser.**
   `lib/schemas/expense-filters.ts` is imported by `useUrlFilters` on every
   list screen and the dashboard, and it built a zod schema to check four
   regular expressions and an enum. It is now zod-free; the entity schemas
   still use zod, because a form needs its messages and `zodResolver`.
   This is the whole of the first-load reduction on `/dashboard` and
   `/expenses`.
3. **Recharts (103 KB) downloaded at hydration on a phone that could not
   see a chart.** `next/dynamic` fetches the moment the boundary renders.
   `components/charts/lazy.tsx` now watches its own box with an
   IntersectionObserver and requests the chunk within 200px of the viewport.
   Desktop, where the charts are in view on load, is unchanged; a phone
   that never scrolls never downloads it. This is most of the drop in script
   a phone downloads on the dashboard (392 → 296 KB).
4. **The rupee sign fetched 109 KB of fonts.** `next/font/google` preloads
   the `latin` subset and declares every other subset with a
   `unicode-range`; ₹ (U+20B9) is in `latin-ext`, so the first amount on
   every screen pulled another 84 KB of Inter and 25 KB of Bodoni,
   discovered only after layout. Both faces are now self-hosted from
   `app/fonts` (the same latin bytes Google served, still preloaded), and
   Inter carries a 1.2 KB companion holding only ₹, cut by
   `scripts/subset-symbol-fonts.mjs`. Fonts on the dashboard: 48 + 46 + 84
   + 25 KB → 48 + 46 KB. `tests/unit/font-symbols.test.ts` fails if a
   source file starts rendering a latin-ext glyph the companion lacks.
5. **The page header streamed with the last byte.** The dashboard's
   `PageHeader` sat behind the route's `loading.tsx` with the aggregate
   queries, so the largest text on screen — the description paragraph
   Lighthouse picks as LCP — arrived after everything, and Lighthouse
   charged every script the page loads against it. `page.tsx` now resolves
   the session, acting user and scope, sends the header, and streams the
   body from `dashboard-body.tsx` behind its own Suspense boundary over
   `DashboardBodySkeleton`. Same split on `/expenses/new`. Measured
   unthrottled, the dashboard paragraph now paints at FCP (144 ms) instead
   of ~130 ms after it.

**What is left, and why all three routes sit just under 90.** The mobile
profile is 1.6 Mbps with a 150 ms RTT and a 4× CPU slowdown. On it the
fixed cost is now: 15 KB of HTML, 13 KB of render-blocking CSS, 94 KB of
preloaded fonts, 139 KB of React plus the Next runtime that every route
pays, and 39 KB of framer-motion kept deliberately (item 1).
`/expenses/new` adds react-hook-form (13 KB) and the entity zod schemas
(25 KB), which the form genuinely uses. The remaining levers, none of them
free:

- **Fonts.** `display: optional` would stop the swap from ever costing a
  repaint on a slow connection, at the price of the system font for that
  page load; dropping Bodoni's `opsz` axis would shrink it. Both are design
  decisions, not performance ones, and are left to DESIGN-PRD.
- **`/expenses` deserves the same header split** as the dashboard. Its
  header carries the scope switcher, so it needs a moment's thought about
  what the header can know before the query runs.
- **`vaul` (8 KB) and the Radix dialog stack (10 KB)** are mounted on every
  route by the mobile tab bar's "More" sheet and the command palette. Both
  open on interaction only and could load then.

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

1. **Get the mobile-preset Performance score over 90** on `/dashboard`,
   `/expenses` and `/expenses/new` (62 / 72 / 72 on 2026-09-02). Start with the
   70 KB `unminified-javascript` finding — find which chunk skips minification
   — then the 161–213 KB of `unused-javascript` per route. Re-run Lighthouse
   with the same command and update §1.
2. **Walk the six screens at five widths.** The static audit found nothing,
   but it cannot see overlap.
3. **Generate receipt thumbnails at upload time** (e.g. a 320px WebP beside
   the original) and serve those in `ReceiptTile`. The lazy-loading fix
   reduces the cost; it does not remove it — a 4 MB image is still 4 MB when
   it eventually loads.
4. Re-run `next build` after any of the above and update the table at the top.

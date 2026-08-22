# Verification runbook

**Why this file exists.** D5.3 and D5.4 were ticked in `DESIGN-PLAN.md` while
`docs/A11Y-AUDIT.md` and `docs/PERF-AUDIT.md` each stated plainly that their
browser-dependent checks had never run. The checkboxes are now unticked, and
this is the sequence that earns them back.

Everything below needs **a working `next build` / dev server and a browser** —
which is exactly what has never worked on the build host. So step 0 comes
first: it is not preamble, it is the blocker.

---

## 0. Repair the dependency tree — do this before anything else

`docs/DESIGN-QA.md` attributes every unrun check to two failures on the build
host:

- `next build` → `STATUS_STACK_BUFFER_OVERRUN` (Windows `0xC0000409`)
- `next dev` → `RangeError: Array buffer allocation failed`, even with
  `--max-old-space-size=4096`

Both are native/memory failures rather than compile errors, and there is a
concrete, observable cause in the repo. **This is a diagnosis, not a confirmed
fix** — it has not been reproduced, because the crash is Windows-native and the
only shell available for this work was Linux.

### The evidence

| Observation | Where |
|---|---|
| **Two lockfiles**, written a minute apart | `package-lock.json` (Aug 20 01:13), `pnpm-lock.yaml` (Aug 20 01:12) |
| **`node_modules` carries BOTH package managers' markers** | `.package-lock.json` (npm) *and* `.modules.yaml` (pnpm) in the same tree |
| **`pnpm-workspace.yaml` is an unanswered prompt** | Every entry reads literally `set this to true or false` — for `@prisma/client`, `@prisma/engines`, `esbuild`, `sharp`, `tesseract.js`, `unrs-resolver` |
| **Next actively shells out to pnpm** | Running `next build` produced `Failed to get registry from "pnpm"` — Next detects `pnpm-lock.yaml` and tries to use pnpm to fetch its SWC binary |
| **Nothing pins a package manager or Node version** | No `packageManager` field, no `engines.node` in `package.json` |

### Why this plausibly causes both crashes

`allowBuilds` in `pnpm-workspace.yaml` is pnpm's approval gate for postinstall
scripts. Left as placeholder text, the native packages behind it — Prisma's
query engine, `sharp`, `esbuild`, `tesseract.js` — may never have been built or
linked correctly. Layer an npm install (flat hoisting) over a pnpm install
(symlinked store) in one `node_modules` and it becomes possible to load two
copies of the same native addon into one process. That is a textbook route to
a stack-buffer overrun in a native module, and to heap exhaustion in a dev
server holding a duplicated module graph.

It also explains a detail that would otherwise be odd: the tree contained
*only* `win32` native binaries, so it was undeniably installed on Windows —
yet `next build` still went looking for a package manager to fetch SWC from.

### The repair

Pick **one** package manager. CI uses `npm ci`, so npm is the lower-risk choice.

```bash
# From the repo root, on the build host.
git rm --cached pnpm-lock.yaml pnpm-workspace.yaml   # or `git rm` to delete outright
rm -rf node_modules .next
npm ci
npx prisma generate
npm run build
```

Then pin it so the tree cannot go hybrid again — add to `package.json`:

```json
"packageManager": "npm@10.9.8",
"engines": { "node": ">=22 <23" }
```

**If the build still crashes after a clean `npm ci`**, the dependency tree was
not the cause. Next steps in order:

1. `npm run build -- --debug` and capture the last module before the crash.
2. Try Node 20 LTS — `STATUS_STACK_BUFFER_OVERRUN` in SWC has historically been
   Node-version-sensitive on Windows.
3. Build in WSL2, which sidesteps the Windows native loader entirely and is the
   fastest way to separate "our code" from "this host".
4. Only then suspect application code — nothing in `app/**` recurses deeply
   enough to overflow a stack, and `tsc --noEmit` is clean.

---

## 1. The suites, in order

Each one's result goes in the table at the bottom of this file. **Record the
number even when it fails** — a recorded failure is progress; a blank row is
what this whole file exists to prevent.

```bash
docker compose up -d                 # postgres + minio
npx prisma migrate deploy
npm run seed                         # acme + globex, every role

npm run test                         # 56 files / 618 tests — green on Linux
npm run test:isolation               # needs the DB above
npx playwright install chromium
npm run test:e2e                     # signup → submit → approve → reimburse
npm run test:a11y                    # axe over 29 routes + 2 overlays
npm run screenshots                  # writes the baseline into docs/screenshots/
```

**Expect `test:a11y` to fail on its first real run.** It has never executed, and
it now scans 29 routes rather than 18. That is the point of it — findings here
are the deliverable, not a setback. Fix each violation, then re-run.

## 2. Lighthouse

Against a **production** build, not the dev server — dev serves unminified
bundles and unoptimised images, which understates Performance badly enough to
be misleading.

```bash
npm run build && npm run start       # http://localhost:3000
npx lighthouse http://localhost:3000/dashboard     --only-categories=performance,accessibility --output=json --output-path=./docs/lh-dashboard.json
npx lighthouse http://localhost:3000/expenses      --only-categories=performance,accessibility --output=json --output-path=./docs/lh-expenses.json
npx lighthouse http://localhost:3000/expenses/new  --only-categories=performance,accessibility --output=json --output-path=./docs/lh-expenses-new.json
```

Lighthouse reports CLS directly. **INP is not measured by a Lighthouse lab
run** — it needs real interaction. Use Chrome DevTools → Performance, record
while clicking a filter facet, opening the submit dialog and paging the
expenses table, and read INP from the interactions track.

Targets: Performance ≥90 · Accessibility ≥95 · CLS <0.05 · INP <200ms.

## 3. Manual passes

Neither can be automated, and both are required by D5.3.

**Keyboard** — submit an expense, approve a report, mark one reimbursed, using
only the keyboard. Watch for: focus visible at every stop; focus order matching
reading order; focus trapped inside dialogs and sheets and **restored to the
trigger** on close; Esc closing every overlay. The two places to look hardest
are the payment-run sheet (two steps, so focus has somewhere to get lost) and
the approval queue's optimistic row removal (the row leaves under the cursor —
where does focus land?).

**Screen reader** — same three flows with NVDA or VoiceOver. Confirm: every
field announces its label; errors are announced via `aria-live`; status badges
read as "Status: Approved" rather than a bare colour; tables announce column
headers; icon-only buttons have names.

---

## Results

Fill this in as each is run. An empty cell means not run — never assume.

| Check | Target | Result | Date |
|---|---|---|---|
| `npm run test` | green | **618 passed, 56 files** (Linux sandbox) | 2026-08-23 |
| `npm run test:isolation` | green | — | |
| `npm run test:e2e` | green | — | |
| `npm run test:a11y` | 0 violations | — | |
| `npm run screenshots` | baseline committed | — | |
| Lighthouse `/dashboard` — Performance | ≥90 | — | |
| Lighthouse `/dashboard` — Accessibility | ≥95 | — | |
| Lighthouse `/dashboard` — CLS | <0.05 | — | |
| Lighthouse `/expenses` — Performance | ≥90 | — | |
| Lighthouse `/expenses` — Accessibility | ≥95 | — | |
| Lighthouse `/expenses/new` — Performance | ≥90 | — | |
| Lighthouse `/expenses/new` — Accessibility | ≥95 | — | |
| INP (DevTools, interaction trace) | <200ms | — | |
| Keyboard walkthrough — 3 flows | pass | — | |
| Screen-reader pass — 3 flows | pass | — | |

When a row is filled, copy the number into `docs/A11Y-AUDIT.md` or
`docs/PERF-AUDIT.md` **and** tick the matching box in `DESIGN-PLAN.md`. If a
target is missed and not fixed, record the number and leave the box unticked.

---

## What now stops this regressing

`.github/workflows/ci.yml` runs `test:e2e` and `test:a11y` on every push and PR
(G4), after the isolation suite, with Chromium installed and the report uploaded
on failure. Until this runbook is worked through, **CI is the first place these
suites will ever have run** — so the first pipeline after this commit is
expected to go red, and its output is the finding list.

`tests/unit/a11y-coverage.test.ts` keeps the scan honest between runs: it walks
the real route tree and fails `npm run test` if a route exists that the axe
suite never visits. That check needs no browser, so it holds even while
everything above is blocked.

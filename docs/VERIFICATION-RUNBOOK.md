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

Originally written 2026-08-23 and **superseded by the re-examination below** —
one of its five rows turned out to be wrong, so rather than leave a table that
half-contradicts the section under it, the findings now live in one place.

### Re-examined 2026-08-26 — what holds, and what does not

The section above was written with more confidence than the evidence supports.
Re-checked against the actual tree, here is what survives.

**CONFIRMED — the hybrid tree is real and measurable.**

| Evidence | Detail |
|---|---|
| Two lockfiles, both live | `package-lock.json` (mtime Aug 26 11:49), `pnpm-lock.yaml` (Aug 20 01:12) |
| Both managers' markers | `node_modules/.package-lock.json` (Aug 26) **and** `node_modules/.modules.yaml` (Aug 20) |
| A whole leftover pnpm store | `node_modules/.pnpm` holds **550 packages**, sitting under npm's flat tree — npm does not remove it |
| The trees disagree on versions | `@aws-sdk/client-s3` is **3.1112.0** flat and **3.1113.0** in the store |
| Nothing pins a manager or runtime | no `packageManager`, no `engines`, no `.nvmrc` — all three now added |

So `node_modules` matches **neither** lockfile. That is a genuine defect and
worth fixing on its own merits.

**REFUTED — the `allowBuilds` placeholder theory.**

`pnpm-workspace.yaml` is a **pnpm-only** file; npm never reads it. npm was the
*most recent* installer (Aug 26 > Aug 20), so postinstall scripts ran under
npm's rules and those placeholders gate nothing today. The original section
presented this as a likely cause. It is not one.

**WEAKENED — "Next cannot find its SWC binary".**

`node_modules/@next/swc-win32-x64-msvc` is present. Next *does* shell out to
pnpm when it needs to fetch anything (observed directly: `Failed to get
registry from "pnpm"`), which is a real bug caused by the stray lockfile — but
the binary it would fetch is already there.

**UNPROVEN — that any of this causes `STATUS_STACK_BUFFER_OVERRUN`.**

`0xC0000409` is a stack-buffer-overrun `__fastfail`, usually from native code.
The native packages that could plausibly do it — `sharp`, `tesseract.js` — are
the **same version** in both trees, which is the opposite of what the
two-copies theory predicts. The hybrid tree is a strong candidate and must be
cleaned up regardless, but **treat the repair below as a hypothesis to test,
not a known cure.** If the build still dies afterwards, the bisect ladder is
the real work, and the cause is elsewhere.

### The repair

Pick **one** package manager. CI uses `npm ci`, so npm is the lower-risk choice.

The pnpm files are **already removed from git** and `package.json` now pins
`packageManager: npm@10.9.8` and `engines.node >=22 <23`. What remains is the
on-disk half, which only the build host can do:

```powershell
# PowerShell — no && ; run these as separate lines.
git checkout .                       # drops pnpm-lock.yaml / pnpm-workspace.yaml
Remove-Item -Recurse -Force node_modules, .next
npm ci
npx prisma generate
npm run build
```

`npm run lint` now includes `scripts/check-lockfiles.mjs`, which fails the
build if a second lockfile ever reappears or if a manager-specific config is
left behind without its lockfile. That is the regression guard for this
specific mistake; it is cheap and needs neither a database nor a network.

**If the build still crashes after a clean `npm ci`** — which, per the
re-examination above, is a real possibility — work the ladder in order and
record the result of each rung. Each one splits the search space; stop at the
first that changes the outcome.

| # | Try | What it tells you |
|---|---|---|
| 1 | `npx next build --no-lint` | Separates the ESLint pass from compilation. If this survives, the crash is in linting, not the build. |
| 2 | `node --max-old-space-size=8192 ./node_modules/next/dist/bin/next build` | Distinguishes a memory ceiling from a stack overrun. `RangeError: Array buffer allocation failed` on `next dev` points at memory; `0xC0000409` does not, so if raising the heap fixes both they were one problem. |
| 3 | `node -v` against the new `engines` pin (`>=22 <23`) | A Node major mismatch is the single most common source of native-addon `__fastfail` on Windows. This is now pinned but was not before — the crash may predate the pin. |
| 4 | `$env:NEXT_TELEMETRY_DISABLED=1; npx next build --debug` | Captures the last module before the crash. That module name is the actual answer; everything above is elimination. |
| 5 | Move `app/api/**` aside and build | Route-handler **trace collection** walks the dependency graph and is the phase most likely to recurse deeply. If the build survives without API routes, bisect them. |
| 6 | Build in WSL2 | Sidesteps the Windows native loader entirely. Green in WSL2 and red on Win32 means the host, not the code — and that is a supportable place to stop. |

Two things worth knowing before you start: `tsc --noEmit` is clean and the full
unit suite passes, so this is not a type or logic error; and nothing in
`app/**` recurses deeply enough to overflow a stack by itself, which is why
rungs 3–6 (host and toolchain) rank above "suspect our code".

**Record what each rung did**, even the ones that changed nothing. A bisect
whose negative results are not written down gets repeated.

---

## 1. The suites, in order

Each one's result goes in the table at the bottom of this file. **Record the
number even when it fails** — a recorded failure is progress; a blank row is
what this whole file exists to prevent.

```bash
docker compose up -d                 # postgres + minio
npx prisma migrate deploy
npm run seed                         # acme + globex, every role

npm run test                         # 59 files / 727 tests — green on Linux
npm run test:isolation               # needs the DB above
npx playwright install chromium
npm run test:e2e                     # signup → submit → approve → reimburse
npm run test:a11y                    # axe over 34 routes + 2 overlays
npm run screenshots                  # writes the baseline into docs/screenshots/
```

**Expect `test:a11y` to fail on its first real run.** It has never executed, and
it now scans 34 routes rather than 18. That is the point of it — findings here
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
| `npm run test` | green | **727 passed, 59 files** (Linux sandbox) | 2026-08-26 |
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

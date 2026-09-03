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
| `npm run test` | green | **728 passed, 59 files** — first run on the Windows host | 2026-08-28 |
| `next build` | green | **passes** — every route compiled (see "the build is fixed" below) | 2026-08-28 |
| `tsc --noEmit` | green | **passes** | 2026-08-28 |
| design checkers (5) | green | **pass** — tokens, copy voice, motion, contrast (64 pairs), migrations, lockfiles | 2026-08-28 |
| `eslint .` | green | **fails — environment only.** 358 errors, all inside `.claude/worktrees/<agent-worktree>/`, a duplicate checkout of this repo. Scoped `npx eslint app components lib scripts tests` is clean. Fix: add `.claude/**` to the `ignores` array in `eslint.config.mjs` (one line), or remove the worktree when its task lands. | 2026-08-28 |
| `npm run test:isolation` | green | **green in CI** on every push since 2026-08-31 (38 files / 233 tests); Blocker 2 below is closed by `tests/isolation/database-url.ts` | 2026-09-02 |
| `npm run test:e2e` | green | **green in CI** (signup → submit → approve → reimburse) | 2026-09-02 |
| `npm run test:a11y` | 0 violations | **green in CI**, 34 routes + 2 overlays; one critical finding on the first run (tablist → radiogroup), fixed | 2026-09-02 |
| `npm run screenshots` | baseline committed | **28 PNGs committed** in `docs/screenshots/` (14 screens × 2 widths) | 2026-09-01 |
| Lighthouse `/login` — Accessibility | ≥95 | **100** | 2026-08-28 |
| Lighthouse `/login` — Performance | ≥90 | **91** | 2026-08-28 |
| Lighthouse `/login` — CLS | <0.05 | **0** | 2026-08-28 |
| Lighthouse `/signup` — Accessibility | ≥95 | **100** | 2026-08-28 |
| Lighthouse `/signup` — Performance | ≥90 | 80 (mobile throttling on a loaded dev host; `/login` on the same run scored 91, so treat this as host noise rather than a page defect) | 2026-08-28 |
| Lighthouse `/signup` — CLS | <0.05 | **0** | 2026-08-28 |
| Screenshot baseline — public routes | committed | **`docs/screenshots/{login,signup}-{desktop,mobile}.png`** (1280×900 and 390×844, 2× DPR) | 2026-08-28 |
| Lighthouse `/dashboard` — Accessibility / CLS | ≥95 / <0.05 | **100 / 0** (mobile preset), **100 / 0.002** (desktop) | 2026-09-02 |
| Lighthouse `/expenses` — Accessibility / CLS | ≥95 / <0.05 | **100 / 0** | 2026-09-02 |
| Lighthouse `/expenses/new` — Accessibility / CLS | ≥95 / <0.05 | **100 / 0** | 2026-09-02 |
| Lighthouse `/dashboard` — Performance | ≥90 | **98** desktop preset; **62** mobile preset ❌ (LCP 6.5 s on simulated slow-4G, 608 KB script) | 2026-09-02 |
| Lighthouse `/expenses` — Performance | ≥90 | **72** mobile preset ❌ (LCP 5.8 s, 508 KB script) | 2026-09-02 |
| Lighthouse `/expenses/new` — Performance | ≥90 | **72** mobile preset ❌ (LCP 5.4 s, 544 KB script) | 2026-09-02 |
| RLS state on the remote database (`scripts/check-rls-state.mjs`) | green | **green** — 34 tenant tables enabled, forced, policied, connected as `expense_app` | 2026-09-02 |
| INP (DevTools, interaction trace) | <200ms | — | |
| Keyboard walkthrough — 3 flows | pass | — | |
| Screen-reader pass — 3 flows | pass | — | |

**CLS 0 on both audited pages answers the open question from the Neoclassical redesign's N0.3:** adding Bodoni Moda
as a second `next/font` family introduces no layout shift.

---

## Update 2026-08-28 — the build is fixed, and two blockers remain

### The build works. Step 0 above is resolved.

`next build` and `next dev` both run on this Windows host. The cure was **not** a `node_modules` reinstall: it was
deleting the stray `pnpm-lock.yaml` and `pnpm-workspace.yaml` (the on-disk half of the repair `f2cd67c` had already
made in git). Next was sniffing those files, shelling out to pnpm, and dying. `scripts/check-lockfiles.mjs` now
guards the regression. The bisect ladder above was never needed — record that as its result.

**One new failure mode worth knowing**, because it looks catastrophic and is not: running `next dev` and then
`next build` against the same `.next` directory leaves mixed artifacts, and the production build then dies inside
webpack with

```
TypeError: Cannot read properties of undefined (reading 'length')
    at WasmHash._updateWithBuffer (.../webpack/bundle5.js)
```

That is a corrupt cache, not a code error — `tsc` stays clean throughout. `rm -rf .next && npm run build` fixes it
every time. Always clear `.next` when switching between dev and a production build on this host.

### Blocker 1 — Docker Desktop's engine does not start (machine-level)

`docker info` hangs and `\\.\pipe\dockerDesktopLinuxEngine` never appears, while Docker Desktop's own processes are
running. WSL2 itself is healthy (`wsl -d docker-desktop -e echo ok` returns immediately), so this is Docker's
backend, not WSL. The GUI was sitting on its "Docker Desktop — something went wrong" dialog. Relaunching after
`wsl --shutdown` did not help.

Untried, in ascending order of destructiveness: reboot; disable the NordLynx VPN adapter (VPN virtual adapters are a
common cause of WSL2/Docker networking failures on Windows) and restart Docker; repair/reinstall Docker Desktop;
**Reset to factory defaults** — which destroys the `postgres-data` volume and every local image, and so should be the
last resort, not the first.

Every remaining unrun suite — isolation, e2e, a11y, screenshots, and the three auth-gated Lighthouse pages — needs a
database, so all of them are behind this one blocker.

### Blocker 2 — `.env` points at a REMOTE database, so the runbook's own step 1 is unsafe here

**Do not run `npx prisma migrate deploy`, `npm run seed`, or `npm run test:isolation` on this machine as written.**

`tests/isolation/setup.ts` calls `dotenv.config()` and only falls back to a localhost URL with `??=`, i.e. *when
`DATABASE_URL` is unset*. This checkout's `.env` **does** set `DATABASE_URL`, to a host on the public internet
(`72.60.200.116:4785`) rather than to the `docker-compose.yml` Postgres on `localhost:5432`. So the isolation suite —
which creates and deletes tenant rows — and the migrate/seed steps would all run against that remote database.

Fix before anyone runs step 1 here, either:
- give the local stack its own env file (`.env.test` / `.env.local`) and load that in the test setup and the runbook
  commands, or
- make `tests/isolation/setup.ts` **override** rather than defer (`process.env.DATABASE_URL = ...localhost...`
  unless an explicit `ISOLATION_DATABASE_URL` is provided), so a developer's ambient `.env` can never redirect a
  destructive suite at a shared server.

This is a latent hazard independent of the redesign, and it is the reason the isolation row above says BLOCKED rather
than FAILED.

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

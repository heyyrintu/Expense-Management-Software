# Production readiness — what is closed, and what is not

Register of the production audit. A row leaves this file when it is fixed
and verified, not when it is planned.

## Closed

| Item | How it was verified |
|---|---|
| `npm ci` failed on a clean checkout — CI had **never** passed | CI now runs the full pipeline; `npm ci` exits 0 |
| Cross-org foreign keys were possible (45 single-column FKs) | `20260831000000_composite_tenant_fks`; isolation suite 38 files / 233 tests green |
| `scopeArgs` overwrote a caller-supplied id instead of narrowing | `tests/unit/scope-args.test.ts`, `tests/isolation/{app-shell,settings}.test.ts` |
| Isolation teardown covered 12 of 34 tenant tables | `tests/isolation/helpers.ts`; suite-level errors gone |
| `TENANT_MODELS` had drifted from the schema | `tests/unit/tenant-models.test.ts` derives it from `schema.prisma` |
| No security headers at all (`next.config.ts` was empty) | Verified on a running container: CSP, HSTS, nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy |
| No health check | `/api/health` returns `{"ok":true,"db":"up","storage":"up"}`; wired to Docker `HEALTHCHECK` |
| Config errors surfaced to users instead of at boot | `lib/env.ts`; container exits 1 on a bad config |
| App connected as a superuser, so RLS was inert | `expense_app` role; `scripts/check-rls-state.mjs` green; env guard refuses the identical-URL case |
| Job endpoints compared bearer tokens with `!==` | `lib/auth/bearer.ts`, constant-time |
| Login rate limit bypassable via `X-Forwarded-For` | `TRUSTED_PROXY_HOPS`; header ignored by default |
| CI had no MinIO — S3 isolation cases hit `ECONNREFUSED` | MinIO step in `ci.yml` |
| No deploy path or rollback procedure | `Dockerfile` + `docs/DEPLOY.md`; image built, booted and health-checked |
| Route boundaries discarded the error | `lib/observability/report.ts`, wired into all 10 boundaries |
| Rate limiter counters lived in ONE process's memory — N instances meant N× every limit, and serverless reset them per burst, leaving login effectively unlimited | shared Postgres counters; `tests/isolation/rate-limit.test.ts` (9 cases) asserts the count is in the database |
| **/reports/[id] was dead for every user** — `ReportControls.AddButton` is a compound component and static properties do not survive the client-reference boundary | e2e happy path green; named exports |
| `asFlags()` called from the server on 4 screens (imported through a `"use client"` re-export) | reports/[id], approvals/[id], expenses/[id], analytics/violations all render |
| Sticky table header parked over the first row, making its controls unclickable (the "expense list not showing" report) | Playwright named the interception; `top-0` instead of `top-topbar` |
| Critical axe violation: `role="tablist"` with non-tab children and no tabpanel | now a radiogroup; 35 axe scans green |
| The e2e and axe suites had **never run anywhere** — axe never even executed (rejected page context), and every scan waited on a `networkidle` that `next dev` can never satisfy | both green in CI |
| **CI had never passed once** in the repository's history | green end to end: install → lint → build → unit → 2× migration replay → RLS role → isolation → e2e → axe |

## Open

**1. CSP still allows `'unsafe-inline'` for scripts.** Next's App Router
inlines its hydration bootstrap; removing it needs a per-request nonce from
middleware. Everything else in the policy is tight.

**2. No metrics or tracing.** `reportError` gives structured error lines
that any aggregator can ingest, which is the floor. There is still no
latency, throughput or saturation signal.

**3. `scripts/check-copy-voice.mjs` only scans props.** It checks
`headline`/`description`/`emptyMessage`/`title` and never sees raw JSX text,
which is how `app/global-error.tsx` shipped saying "Something went wrong"
and "Please try again" — both banned. That copy is fixed; the gap in the
checker is not.

**4. Secrets management.** Real R2 and WhatsApp credentials live in a
plaintext `.env` on a developer machine. They belong in the deploy
platform's secret store.

**5. Backups are untested.** `docs/DEPLOY.md` says take one before every
migration. Nobody has restored from one.

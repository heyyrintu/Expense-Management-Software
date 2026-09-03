# Visual baseline

Captured by `tests/e2e/screenshots.spec.ts` (`npm run screenshots`): 14 screens
× 2 widths — desktop (1280×900) and mobile (390×844), both at 2× DPR. The 12
tenant screens run against a freshly provisioned org with three real expenses,
so the baseline records working screens rather than empty states; `login` and
`signup` are the two public routes.

| Screen | Files | Captured |
|---|---|---|
| login, signup | `{login,signup}-{desktop,mobile}.png` | 2026-08-28 |
| dashboard, expenses, add-expense, reports, approval-queue, finance-queue, ledger, reconciliation, complaints, profile, settings-organization, settings-users | `<screen>-{desktop,mobile}.png` | 2026-09-01 |

## Re-capturing

```bash
docker compose up -d          # postgres + minio
npx prisma migrate deploy
npm run screenshots
```

## What this is for

A reference a human compares against at review time, not an assertion. The
spec deliberately does **not** use `toHaveScreenshot`: a pixel-diff assertion
fails on antialiasing differences between machines, and a visual test that
cries wolf gets muted within a month. The baseline's job is to make a change
visible in a diff when someone looks at it.

Re-capture after any deliberate visual change, in the same commit that makes
it — the same rule `/design-system` follows.

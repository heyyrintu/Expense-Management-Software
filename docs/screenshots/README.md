# Visual baseline

**Empty.** The capture harness exists (`tests/e2e/screenshots.spec.ts`) and is
wired to `npm run screenshots`, but it has **never been run** — see the
"Verification gaps" section of `docs/DESIGN-QA.md`. No browser has been
connectable in any session of this build, and the dev server on the build
machine dies with `RangeError: Array buffer allocation failed` before serving
a page.

## Filling it

```bash
docker compose up -d          # postgres + minio
npx prisma migrate dev
npm run screenshots
```

That writes 24 PNGs here — 12 screens × 2 widths (1440px desktop, 390px
mobile) — with a freshly provisioned org and three real expenses, so the
baseline records working screens rather than empty states.

## What this is for

A reference a human compares against at review time, not an assertion. The
spec deliberately does **not** use `toHaveScreenshot`: a pixel-diff assertion
fails on antialiasing differences between machines, and a visual test that
cries wolf gets muted within a month. The baseline's job is to make a change
visible in a diff when someone looks at it.

Commit the PNGs once captured. Re-capture after any deliberate visual change,
in the same commit that makes it — the same rule `/design-system` follows.

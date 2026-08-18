# CLAUDE.md — Expense Management SaaS (multi-tenant)

Multi-tenant expense management web app (Fyle/Sage-style). Source of truth for requirements: `PRD-expense-management-system.md`. Build order: `PLAN.md`. Do not invent features beyond the PRD phase you are working on.

## Stack

- **App**: Next.js 15 (App Router, TypeScript, strict mode)
- **UI**: Tailwind CSS + shadcn/ui; responsive, mobile-first for the expense-capture flow
- **DB**: PostgreSQL 16 + Prisma ORM; migrations via `prisma migrate`
- **Auth**: Auth.js (credentials provider), session JWT carries `userId`, `orgId`, `role`
- **Storage**: S3-compatible (local: MinIO) — receipts under `/{orgId}/receipts/{expenseId}/`
- **OCR**: stub interface `lib/ocr/index.ts` (`extractReceipt(file) -> {merchant?, date?, amount?}`); Tesseract.js implementation behind it. Never block expense creation on OCR failure.
- **Tests**: Vitest (unit) + Playwright (e2e); tenant-isolation test suite is mandatory
- **Validation**: Zod schemas shared between API and forms

## Commands

```bash
npm run dev            # start dev server (docker compose up -d first: postgres + minio)
npm run build          # production build — must pass before any commit
npm run test           # vitest
npm run test:isolation # cross-tenant isolation suite — must pass before any commit
npm run test:e2e       # playwright
npx prisma migrate dev # create/apply migration
npm run lint           # eslint + tsc --noEmit
npm run seed           # seed 2 demo orgs (acme, globex) with users of every role
```

## Non-negotiable rules

### Tenant isolation (the one rule that can never break)
- **Every table has `org_id`.** Every query is scoped by it. No exceptions.
- All DB access goes through `lib/db/scoped.ts` (`scopedDb(orgId)`), which injects `org_id` into every where/create. **Never call the raw Prisma client from route handlers or server components.**
- Postgres Row-Level Security is enabled on every tenant table as defense-in-depth; app sets `app.current_org_id` per request/transaction.
- `orgId` always comes from the server session — **never from request params, body, or headers**.
- Receipt signed URLs are generated only after verifying the receipt's `org_id` matches the session.
- Any new endpoint or query requires a matching case in `tests/isolation/` proving org B cannot read/write org A's data.

### Authorization
- Roles: `employee < approver < finance_admin < org_admin` (+ platform `super_admin`, no org data access).
- Check role server-side in every route handler/server action via `lib/auth/guard.ts` helpers (`requireRole(...)`). UI hiding is not authorization.
- An approver can never approve their own report.

### Domain invariants
- Report state machine: `Draft → Submitted → Approved | Rejected | SentBack → Reimbursed`. Transitions only through `lib/domain/report-workflow.ts`; every transition writes an `AuditLog` row.
- Money is stored as integer minor units (cents/paise), never floats. Use `lib/money.ts`.
- Policy violations **flag, never block** — approver may approve with a logged justification.
- Duplicate detection: same `org_id + user_id + amount + date + merchant` (case-insensitive merchant).
- Nothing is hard-deleted once a report leaves Draft; use status fields. AuditLog is append-only.

## Conventions

- Feature-folder layout: `app/(app)/[feature]/`, domain logic in `lib/domain/`, one Zod schema per entity in `lib/schemas/`.
- Server components by default; client components only for interactivity (`"use client"` at the leaf).
- API: server actions for mutations, route handlers only for uploads/webhooks/exports.
- Errors: return typed results `{ok, error}` from actions; no thrown strings; user-facing messages come from `lib/errors.ts`.
- Naming: DB `snake_case`, TS `camelCase`, components `PascalCase`. IDs are UUIDv7.
- Migrations: never edit an applied migration; additive first, destructive only with a backfill plan.
- Commits: conventional (`feat:`, `fix:`, `test:`, `chore:`); every feat commit includes its tests.

## Definition of done (every task)

1. `npm run lint && npm run build` clean
2. Unit tests for domain logic; isolation tests for any new data access
3. Works for both seed orgs (acme, globex) with no data bleed
4. AuditLog written for any state change
5. PLAN.md task checked off

## Skills

Use the project skills in `.claude/skills/` (see `SKILLS.md`): `add-feature-module`, `tenant-isolation-check`, `db-migration`, `ui-screen`. Invoke the relevant skill before starting matching work.

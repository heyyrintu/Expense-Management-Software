# Expense Management (multi-tenant)

Multi-tenant expense management web app (Fyle/Sage-style). Requirements: `PRD-expense-management-system.md`. Build order: `PLAN.md`. Project rules: `CLAUDE.md`.

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind CSS v4 + shadcn/ui · PostgreSQL 16 + Prisma · Auth.js · MinIO (S3) · Vitest + Playwright · Zod

## Prerequisites

- Node.js 20+ and npm
- Docker (for Postgres + MinIO)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Environment
cp .env.example .env   # then set AUTH_SECRET (openssl rand -base64 32)

# 3. Start infrastructure (Postgres :5432, MinIO :9000 / console :9001)
docker compose up -d

# 4. Run the dev server
npm run dev            # http://localhost:3000
```

MinIO console: http://localhost:9001 (minioadmin / minioadmin). A `receipts` bucket is created automatically.

## Commands

```bash
npm run dev            # dev server (docker compose up -d first)
npm run build          # production build — must pass before any commit
npm run lint           # eslint + tsc --noEmit
npm run test           # vitest unit tests
npm run test:isolation # cross-tenant isolation suite (needs docker compose up -d + migrate)
npm run test:e2e       # Playwright happy path (needs docker compose up -d + migrate; first run: npx playwright install chromium)
```

```bash
npx prisma migrate dev   # apply migrations (docker compose up -d first)
npx prisma generate      # regenerate Prisma client
npm run seed             # seed demo orgs acme + globex (4 roles each)
```

Demo logins after seeding: `employee@acme.test`, `approver@acme.test`, `finance_admin@acme.test`, `org_admin@acme.test` (same for `globex`), password `Password123!`.

**DB roles**: the app connects as `expense_app` (non-superuser — RLS enforced); `expense` (superuser) is for migrations/seed only via `DIRECT_DATABASE_URL`. If your Postgres volume predates this, recreate it (`docker compose down -v && docker compose up -d`) so the init script creates the role.

## Scheduled jobs

Daily pending-approvals digest (5.6) — schedule with any cron:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/jobs/approval-digest
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/recurring   # daily: drafts recurring expenses
```

## Email receipt ingestion (6.6)

Employees email receipts to `receipts+{orgslug}@$APP_MAIL_DOMAIN`. Configure a
Mailgun receiving route (`match_recipient("receipts+.*@$APP_MAIL_DOMAIN")` →
`forward("https://<host>/api/webhooks/inbound-email")`) and set
`MAILGUN_WEBHOOK_SIGNING_KEY` + `APP_MAIL_DOMAIN`. Senders must match a
verified active user email in that org; failures appear for org admins under
Settings → Email ingestion.

## Non-negotiables (see CLAUDE.md)

- Every table has `org_id`; all DB access via `scopedDb(orgId)`; RLS as defense-in-depth
- `orgId` only from the server session
- Money as integer minor units; report state machine via `lib/domain/report-workflow.ts`; AuditLog on every transition

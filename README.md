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

## Non-negotiables (see CLAUDE.md)

- Every table has `org_id`; all DB access via `scopedDb(orgId)`; RLS as defense-in-depth
- `orgId` only from the server session
- Money as integer minor units; report state machine via `lib/domain/report-workflow.ts`; AuditLog on every transition

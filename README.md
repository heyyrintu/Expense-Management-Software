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
```

Coming in later milestones (see PLAN.md): `npm run test`, `npm run test:isolation`, `npm run test:e2e`, `npm run seed`, `npx prisma migrate dev`.

## Non-negotiables (see CLAUDE.md)

- Every table has `org_id`; all DB access via `scopedDb(orgId)`; RLS as defense-in-depth
- `orgId` only from the server session
- Money as integer minor units; report state machine via `lib/domain/report-workflow.ts`; AuditLog on every transition

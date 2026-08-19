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
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/monthly-summary  # 1st of month: finance summary email + CSV
```

## Email receipt ingestion (6.6)

Employees email receipts to `receipts+{orgslug}@$APP_MAIL_DOMAIN`. Configure a
Mailgun receiving route (`match_recipient("receipts+.*@$APP_MAIL_DOMAIN")` →
`forward("https://<host>/api/webhooks/inbound-email")`) and set
`MAILGUN_WEBHOOK_SIGNING_KEY` + `APP_MAIL_DOMAIN`. Senders must match a
verified active user email in that org; failures appear for org admins under
Settings → Email ingestion.

## WhatsApp channel (8.1)

Entirely optional. With no configuration the feature is invisible — no nav
entries, no profile panel, no webhook activity — and the rest of the app is
unaffected.

**Provider abstraction.** `lib/whatsapp/types.ts` defines the contract
(`sendText`, `sendTemplate`, `sendMedia`, `downloadMedia`, `verifyWebhook`,
`verifySignature`). `lib/whatsapp/meta.ts` implements it against the Meta Cloud
API and is the only file that knows about Graph URLs or Meta payload shapes;
swapping in Twilio means writing one class and changing `providerFor()` in
`lib/whatsapp/config.ts`.

**Configuration.** Either set the `WA_*` variables (see `.env.example`) for a
single shared business number, or let each org enter its own credentials in
**Settings > WhatsApp** (org_admin). Per-org values win; anything left blank
falls back to env. Credentials are encrypted with AES-256-GCM before they are
stored, using `APP_ENCRYPTION_KEY` — set that first or saving is refused.

**Webhook.** Register `https://<host>/api/webhooks/whatsapp` in Meta ▸
Configuration with the verify token from settings. `GET` answers the
subscription handshake; `POST` requires a valid `X-Hub-Signature-256` computed
over the raw body with the app secret.

**Routing.** An inbound message is routed by the **business** number
(`metadata.phone_number_id` -> `whatsapp_accounts.phone_number_id`, globally
unique), never by the sender. The same personal number can be linked in
several orgs; only after the org is known is the sender matched against that
org's verified links. Unknown numbers get one rate-limited "link your number"
reply and nothing is stored.

**Linking.** Each person links their own number from **My profile**: enter the
number (Indian numbers work without the country code), receive a 6-digit code
over WhatsApp, confirm. Codes are stored only as SHA-256 hashes, expire in 10
minutes, and allow 5 attempts.

**Capturing expenses (8.2).** Once linked, a person can send:

- a **photo or PDF receipt** — it is downloaded, stored under the org's receipt
  prefix, OCR'd, and becomes a Draft expense;
- a **quick note with an amount** — "lunch 450", "₹1,250 client dinner" — which
  becomes a Draft with the message as its purpose.

The bot replies with a summary ("Blue Tokai, ₹450.00, 12 Aug — correct?") and
three buttons: **Looks right** (keeps the draft), **Edit** (deep link into the
app) and **Discard** (deletes the draft and its receipt). Callbacks are
idempotent — Meta redelivery is stopped by the unique `wa_message_id`, and a
second tap simply reports that it was already handled. Discard only ever
touches a Draft; anything already on a report is left alone.

Everything arrives as a Draft flagged "created from WhatsApp", so the normal
report and approval path is unchanged. Messages with no readable amount get a
short help reply; files over 10 MB or of an unsupported type are politely
refused. Every action is audit-logged with `channel: "whatsapp"`.

## Non-negotiables (see CLAUDE.md)

- Every table has `org_id`; all DB access via `scopedDb(orgId)`; RLS as defense-in-depth
- `orgId` only from the server session
- Money as integer minor units; report state machine via `lib/domain/report-workflow.ts`; AuditLog on every transition

# Deploying

Until now nothing in this repo described how the app reaches a server. There
was no Dockerfile, no platform config and no rollback procedure — `docker
compose up` provisions Postgres and MinIO for local development and nothing
else. This file and the `Dockerfile` beside it are that missing piece.

---

## 0. The two things that must be true before any deploy

**The app must NOT connect as a superuser or as the table owner.** Postgres
exempts both from row-level security. Point `DATABASE_URL` at the
non-superuser app role and keep `DIRECT_DATABASE_URL` — the owner — for
migrations and seeding only. `lib/env.ts` now refuses to boot when the two
are identical, and `node scripts/check-rls-state.mjs` reports what the
current connection actually is:

```bash
node scripts/check-rls-state.mjs
# connected as: expense_app  superuser: false
# ✔ RLS enabled and forced on every table checked.
```

Provision the role with `docker/postgres-init/01-app-role.sql`. That file
runs automatically on a fresh Docker volume; on a managed database it has to
be applied by hand, and **the `ALTER DEFAULT PRIVILEGES FOR ROLE expense`
lines must name your actual owner role** (often `postgres`). Get that wrong
and tables created by future migrations are invisible to the app — the app
keeps working until the next migration, then breaks.

**Secrets belong in the platform's secret store, not in `.env`.** The R2
keys grant read/write to every tenant's receipts.

---

## 1. Build and run

```bash
docker build -t expense-app:$(git rev-parse --short HEAD) .
```

The image is Node 22 on Alpine, matching `engines` and the CI runner. It
runs as a non-root user, carries no package manager, and ships `prisma/`
with the app so the code and the migrations it expects travel together.

```bash
docker run -d --name expense-app -p 3000:3000 --env-file /path/to/prod.env \
  expense-app:<tag>
```

`HEALTHCHECK` calls `/api/health`, which proves Postgres **and** the receipt
store are reachable — not merely that Node is listening. Point your load
balancer at the same URL.

### On Vercel instead

The Dockerfile is unnecessary there; Vercel builds from source. Two things
still apply: set every variable from `.env.example` in project settings, and
set `TRUSTED_PROXY_HOPS=1` so login rate limiting reads the proxy's entry of
`X-Forwarded-For` rather than the client's. Note the caveat in §4 about the
rate limiter on serverless.

---

## 2. Migrations

Run migrations as a separate step **before** the new image serves traffic,
using the owner connection:

```bash
docker run --rm --env-file /path/to/prod.env expense-app:<tag> \
  npx prisma migrate deploy
```

Every migration in this repo is additive or constraint-only, so it is safe
to apply while the old version is still serving. That is a property to
preserve deliberately, not a guarantee: a destructive migration needs a
backfill plan and a two-deploy sequence (add and write to the new shape,
migrate readers, drop the old shape in a later release).

---

## 3. Rolling back

**Roll back the image first, and only then decide about the database.** They
are separate decisions and conflating them is how a bad deploy becomes data
loss.

```bash
docker stop expense-app && docker rm expense-app
docker run -d --name expense-app -p 3000:3000 --env-file /path/to/prod.env \
  expense-app:<previous-tag>
```

**Do not "roll back" a migration by hand under pressure.** Prisma has no down
migrations, and the additive migrations here are almost always forward
compatible — the previous image can run against the newer schema, because
extra columns and extra constraints do not bother it. The exception is a
migration that adds a constraint the OLD code violates: the composite tenant
FKs in `20260831000000_composite_tenant_fks` are one, since older code could
write a cross-org reference that the constraint now rejects. If you must go
back past a migration like that, restore from a backup taken before it and
accept the data loss window; there is no safe in-place reversal.

Take a backup immediately before every deploy that includes a migration.

---

## 4. Known limitations to size before you scale

**The rate limiter is in-process** (`lib/rate-limit.ts`). Each instance keeps
its own counters, so N instances mean roughly N times the intended limit, and
on serverless — where instances are created and destroyed constantly — it is
close to no limit at all. It is correct for a single long-lived instance and
nothing else. See the note at the top of that file before scaling out.

**There is no error reporting.** `docs/PRODUCTION-CHECKLIST.md` tracks it.
Until it exists, failures are visible only in container logs.

---

## 5. First deploy checklist

- [ ] `expense_app` role exists and owns nothing; `check-rls-state.mjs` is green
- [ ] `DATABASE_URL` ≠ `DIRECT_DATABASE_URL` (the app refuses to boot otherwise)
- [ ] Every variable in `.env.example` set in the platform's secret store
- [ ] `TRUSTED_PROXY_HOPS` matches the number of proxies you actually run
- [ ] `CRON_SECRET` set, and the three job endpoints scheduled
- [ ] Receipt bucket exists, is PRIVATE, and `S3_BUCKET` names it
- [ ] Backup taken, and a restore actually tested
- [ ] `/api/health` returns 200 through the load balancer

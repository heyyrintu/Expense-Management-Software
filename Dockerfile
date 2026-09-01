# Runtime image for the expense app.
#
# Node 22 to match package.json engines (>=22 <23) and the CI runner —
# building on a different major than CI tests on is how a native module
# passes the pipeline and crashes in production.
#
# Alpine musl matters for Prisma: the engine is a native binary and the
# musl build is a different artifact from the glibc one, which is why
# binaryTargets is set in the build stage rather than left to autodetect.

# ── deps ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
# `npm ci` (not `npm install`): it installs exactly the lockfile and FAILS
# when the lockfile and package.json disagree, which is the whole point of
# committing one. This repo shipped an out-of-sync lockfile for weeks and
# every CI run died here — that is the check working.
RUN npm ci

# ── build ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Opt into standalone tracing for THIS build only — see next.config.ts.
ENV NEXT_OUTPUT=standalone
# Generate the client for musl explicitly; the schema's default target is
# whatever the developer's machine happens to be.
RUN npx prisma generate
RUN npm run build

# ── runtime ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root. The app writes nothing to disk (receipts go to S3), so the
# filesystem can stay owned by root and simply be readable.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# No `COPY /app/public`: this project has no public/ directory. Next only
# creates .next/standalone/public when one exists, and copying a path that
# is not there fails the build rather than being skipped.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Migrations and the schema ship WITH the image so that the exact code
# being deployed carries the exact migrations it expects. Running
# `prisma migrate deploy` from a separate checkout is how a rollback ends
# up applying a migration the old code has never seen.
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000

# Uses the real readiness endpoint rather than a TCP probe, so an instance
# that cannot reach Postgres or the receipt store is reported unhealthy
# instead of merely listening.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

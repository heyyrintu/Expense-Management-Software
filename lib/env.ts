// Boot-time environment validation.
//
// Every one of these used to fail LAZILY: AUTH_SECRET threw from inside
// invite-token the first time somebody was invited, APP_ENCRYPTION_KEY threw
// when the first WhatsApp credential was saved, and a bad S3 endpoint
// surfaced as a failed receipt upload. All of them are configuration errors
// knowable at startup, and all of them reached a user first.
//
// In production a bad config THROWS and the process refuses to start, which
// is the whole point — a deploy that cannot work should fail in the deploy,
// not in somebody's expense claim. In development it warns, so a partial
// .env still lets you work on unrelated screens.

import { hasEncryptionKey } from "@/lib/crypto/secret-box";

type Problem = { key: string; detail: string };

/** Reads keys only, so a plain record is enough — and lets tests pass a
 *  minimal environment without inventing every NodeJS.ProcessEnv field. */
export type EnvLike = Record<string, string | undefined>;

export function collectEnvProblems(env: EnvLike = process.env): Problem[] {
  const problems: Problem[] = [];
  const require_ = (key: string, detail: string) => {
    if (!env[key] || env[key]?.trim() === "") problems.push({ key, detail });
  };

  require_("DATABASE_URL", "the app's database connection is missing");
  require_("DIRECT_DATABASE_URL", "migrations and seed have no owner connection");
  require_("AUTH_SECRET", "sessions and invite tokens cannot be signed");

  // The failure this project actually shipped: both URLs pointing at the
  // same superuser. Postgres exempts superusers from row-level security, so
  // every RLS policy in the schema is inert and scopedDb is the only thing
  // standing between two tenants. Worth refusing to boot over.
  if (
    env.DATABASE_URL &&
    env.DIRECT_DATABASE_URL &&
    env.DATABASE_URL === env.DIRECT_DATABASE_URL
  ) {
    problems.push({
      key: "DATABASE_URL",
      detail:
        "identical to DIRECT_DATABASE_URL. DIRECT_DATABASE_URL is the OWNER " +
        "connection and bypasses row-level security, so pointing the app at " +
        "it disables RLS entirely. Point DATABASE_URL at the non-superuser " +
        "app role (see docker/postgres-init/01-app-role.sql)",
    });
  }

  // Reuses the SAME parser the cipher uses, so "the key is valid" cannot
  // mean one thing at boot and another when a credential is decrypted.
  // A 64-character hex string is also valid base64, which is exactly the
  // ambiguity a second implementation here would get wrong.
  if (env.APP_ENCRYPTION_KEY && !hasEncryptionKey(env.APP_ENCRYPTION_KEY)) {
    problems.push({
      key: "APP_ENCRYPTION_KEY",
      detail: "must decode to exactly 32 bytes (openssl rand -base64 32)",
    });
  }

  if (env.TRUSTED_PROXY_HOPS && !/^\d+$/.test(env.TRUSTED_PROXY_HOPS)) {
    problems.push({
      key: "TRUSTED_PROXY_HOPS",
      detail: "must be a non-negative integer (0 disables X-Forwarded-For)",
    });
  }

  if (env.NODE_ENV === "production") {
    require_("AUTH_URL", "Auth.js builds callback URLs from it");
    require_("S3_BUCKET", "receipts have nowhere to go");
    require_("S3_ENDPOINT", "the receipt store has no address");
    require_("S3_ACCESS_KEY_ID", "the receipt store cannot be authenticated to");
    require_("S3_SECRET_ACCESS_KEY", "the receipt store cannot be authenticated to");
    require_("CRON_SECRET", "the scheduled-job endpoints would refuse every call");
  }

  return problems;
}

export function assertEnv(env: EnvLike = process.env): void {
  const problems = collectEnvProblems(env);
  if (problems.length === 0) return;

  const report = problems.map((p) => `  - ${p.key}: ${p.detail}`).join("\n");
  const message = `Environment is not usable:\n${report}`;

  if (env.NODE_ENV === "production") throw new Error(message);
  console.warn(`[env] ${message}`);
}

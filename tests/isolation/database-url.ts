// Decides which database the isolation suite is allowed to run against.
//
// The suite CREATES AND DELETES tenant rows. It used to take whatever
// DATABASE_URL a developer's ambient `.env` supplied and only fell back to the
// docker-compose database when the variable was unset — so a checkout whose
// `.env` points at a shared or remote server would have run the destructive
// suite there (docs/VERIFICATION-RUNBOOK.md, "Blocker 2").
//
// The rule now: a non-local URL is never used implicitly. Either the URL names
// localhost (CI, docker-compose), or the caller opts in explicitly through
// ISOLATION_DATABASE_URL. Anything else is redirected to the local default and
// reported, so the redirect is visible rather than silent.

export const LOCAL_APP_URL =
  "postgresql://expense_app:expense_app@localhost:5432/expense_dev?schema=public";
export const LOCAL_OWNER_URL =
  "postgresql://expense:expense@localhost:5432/expense_dev?schema=public";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return LOCAL_HOSTS.has(host);
  } catch {
    return false;
  }
}

export interface IsolationDatabaseEnv {
  DATABASE_URL: string;
  DIRECT_DATABASE_URL: string;
  /** Keys whose ambient value was non-local and got replaced by the default. */
  redirected: string[];
}

export function resolveIsolationDatabaseEnv(
  env: Record<string, string | undefined>
): IsolationDatabaseEnv {
  if (env.ISOLATION_DATABASE_URL) {
    return {
      DATABASE_URL: env.ISOLATION_DATABASE_URL,
      DIRECT_DATABASE_URL:
        env.ISOLATION_DIRECT_DATABASE_URL ?? env.ISOLATION_DATABASE_URL,
      redirected: [],
    };
  }

  const redirected: string[] = [];
  const pick = (key: "DATABASE_URL" | "DIRECT_DATABASE_URL", fallback: string) => {
    const current = env[key];
    if (isLocalDatabaseUrl(current)) return current as string;
    if (current) redirected.push(key);
    return fallback;
  };

  return {
    DATABASE_URL: pick("DATABASE_URL", LOCAL_APP_URL),
    DIRECT_DATABASE_URL: pick("DIRECT_DATABASE_URL", LOCAL_OWNER_URL),
    redirected,
  };
}

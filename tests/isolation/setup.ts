// Loads .env for local runs (CI sets env directly) and pins the suite to a
// LOCAL database unless the caller opts in explicitly — see database-url.ts
// for why an ambient .env must never be able to aim this suite at a shared
// server.
import { config } from "dotenv";

import { resolveIsolationDatabaseEnv } from "./database-url";

config();

const resolved = resolveIsolationDatabaseEnv(process.env);
process.env.DATABASE_URL = resolved.DATABASE_URL;
process.env.DIRECT_DATABASE_URL = resolved.DIRECT_DATABASE_URL;
if (resolved.redirected.length > 0) {
  console.warn(
    `[isolation] ${resolved.redirected.join(", ")} pointed at a non-local host; ` +
      "using the docker-compose database instead. Set ISOLATION_DATABASE_URL to run elsewhere on purpose."
  );
}
process.env.AUTH_SECRET ??= "isolation-test-secret";

// E2E happy path (PLAN 4.3). Requires: docker compose up -d, migrated DB
// (npx prisma migrate dev). The dev server is started automatically.
import { defineConfig } from "@playwright/test";

// Port is configurable because 3000 is the most contended port on any
// developer's machine. `next dev` quietly falls back to 3001 when it is
// taken, while Playwright kept waiting on 3000 and failed 120 seconds later
// with "Timed out waiting from config.webServer" — which says nothing about
// the actual cause. CI leaves this unset and gets 3000 as before.
const PORT = process.env.E2E_PORT ?? "3000";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    // CI serves the PRODUCTION build; locally it runs the dev server.
    //
    // `next dev` compiles each route on its first visit, so in CI every
    // navigation in a suite that visits ~35 routes paid a cold webpack
    // build and the run died on timeouts that had nothing to do with the
    // assertions. CI already runs `npm run build` before these steps, so
    // `next start` costs nothing extra and removes the compile entirely.
    //
    // It is also the more honest target: it exercises the bundle that
    // actually ships, including the production CSP (dev needs
    // 'unsafe-eval' for its bundler; production does not).
    command: process.env.CI
      ? `npm run start -- --port ${PORT}`
      : `npm run dev -- --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

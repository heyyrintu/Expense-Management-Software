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
    command: `npm run dev -- --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

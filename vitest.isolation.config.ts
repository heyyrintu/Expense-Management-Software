// Cross-tenant isolation suite — requires a live Postgres
// (docker compose up -d + npx prisma migrate dev). CI runs this against a
// postgres:16 service container. A failing cross-tenant case = red build.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/isolation/**/*.test.ts"],
    setupFiles: ["tests/isolation/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // sequential: suites share one database
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});

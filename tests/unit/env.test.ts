import { describe, expect, it } from "vitest";
import { collectEnvProblems, type EnvLike } from "@/lib/env";

const base = {
  DATABASE_URL: "postgresql://expense_app:pw@localhost:5432/db",
  DIRECT_DATABASE_URL: "postgresql://owner:pw@localhost:5432/db",
  AUTH_SECRET: "secret",
} satisfies EnvLike;

const keys = (env: EnvLike) =>
  collectEnvProblems(env).map((p) => p.key);

describe("collectEnvProblems", () => {
  it("passes a minimal development environment", () => {
    expect(collectEnvProblems(base)).toEqual([]);
  });

  it("reports each missing required variable", () => {
    expect(keys({})).toEqual([
      "DATABASE_URL",
      "DIRECT_DATABASE_URL",
      "AUTH_SECRET",
    ]);
  });

  // The failure this project actually shipped: the app connecting as the
  // owner, which Postgres exempts from row-level security.
  it("refuses the app and owner connections being identical", () => {
    const same = "postgresql://postgres:pw@host:5432/db";
    const problems = collectEnvProblems({
      ...base,
      DATABASE_URL: same,
      DIRECT_DATABASE_URL: same,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].detail).toContain("bypasses row-level security");
  });

  it("checks the encryption key decodes to 32 bytes", () => {
    const good = Buffer.alloc(32, 7).toString("base64");
    expect(keys({ ...base, APP_ENCRYPTION_KEY: good })).toEqual([]);
    expect(keys({ ...base, APP_ENCRYPTION_KEY: "too-short" })).toContain(
      "APP_ENCRYPTION_KEY"
    );
  });

  it("accepts a hex encryption key of the same length", () => {
    expect(keys({ ...base, APP_ENCRYPTION_KEY: "ab".repeat(32) })).toEqual([]);
  });

  it("rejects a non-numeric proxy hop count", () => {
    expect(keys({ ...base, TRUSTED_PROXY_HOPS: "1" })).toEqual([]);
    expect(keys({ ...base, TRUSTED_PROXY_HOPS: "yes" })).toContain(
      "TRUSTED_PROXY_HOPS"
    );
  });

  it("demands the deployment-only variables in production", () => {
    const found = keys({ ...base, NODE_ENV: "production" });
    for (const k of [
      "AUTH_URL",
      "S3_BUCKET",
      "S3_ENDPOINT",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "CRON_SECRET",
    ]) {
      expect(found).toContain(k);
    }
  });
});

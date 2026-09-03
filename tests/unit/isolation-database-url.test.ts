import { describe, expect, it } from "vitest";

import {
  LOCAL_APP_URL,
  LOCAL_OWNER_URL,
  isLocalDatabaseUrl,
  resolveIsolationDatabaseEnv,
} from "../isolation/database-url";

const REMOTE = "postgresql://expense_app:secret@72.60.200.116:4785/postgres";
const REMOTE_OWNER = "postgresql://postgres:secret@72.60.200.116:4785/postgres";

describe("isLocalDatabaseUrl", () => {
  it("accepts localhost, 127.0.0.1 and ::1", () => {
    expect(isLocalDatabaseUrl("postgresql://a:b@localhost:5432/x")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://a:b@127.0.0.1:5433/x")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://a:b@[::1]:5432/x")).toBe(true);
  });

  it("rejects a public host, an empty value and garbage", () => {
    expect(isLocalDatabaseUrl(REMOTE)).toBe(false);
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
  });
});

describe("resolveIsolationDatabaseEnv", () => {
  it("keeps a local URL untouched (CI and docker-compose)", () => {
    const ci = {
      DATABASE_URL: "postgresql://expense_app:expense_app@localhost:5432/expense_dev?schema=public",
      DIRECT_DATABASE_URL: "postgresql://expense:expense@localhost:5432/expense_dev?schema=public",
    };
    expect(resolveIsolationDatabaseEnv(ci)).toEqual({ ...ci, redirected: [] });
  });

  it("falls back to the docker-compose defaults when nothing is set", () => {
    expect(resolveIsolationDatabaseEnv({})).toEqual({
      DATABASE_URL: LOCAL_APP_URL,
      DIRECT_DATABASE_URL: LOCAL_OWNER_URL,
      redirected: [],
    });
  });

  it("REDIRECTS a remote URL to the local default and names the key", () => {
    const out = resolveIsolationDatabaseEnv({
      DATABASE_URL: REMOTE,
      DIRECT_DATABASE_URL: REMOTE_OWNER,
    });
    expect(out.DATABASE_URL).toBe(LOCAL_APP_URL);
    expect(out.DIRECT_DATABASE_URL).toBe(LOCAL_OWNER_URL);
    expect(out.redirected).toEqual(["DATABASE_URL", "DIRECT_DATABASE_URL"]);
  });

  it("redirects only the key that is remote", () => {
    const out = resolveIsolationDatabaseEnv({
      DATABASE_URL: "postgresql://a:b@localhost:5433/expense_dev",
      DIRECT_DATABASE_URL: REMOTE_OWNER,
    });
    expect(out.DATABASE_URL).toBe("postgresql://a:b@localhost:5433/expense_dev");
    expect(out.DIRECT_DATABASE_URL).toBe(LOCAL_OWNER_URL);
    expect(out.redirected).toEqual(["DIRECT_DATABASE_URL"]);
  });

  it("honours an explicit ISOLATION_DATABASE_URL even when it is remote", () => {
    const out = resolveIsolationDatabaseEnv({
      DATABASE_URL: "postgresql://a:b@localhost:5432/x",
      ISOLATION_DATABASE_URL: REMOTE,
      ISOLATION_DIRECT_DATABASE_URL: REMOTE_OWNER,
    });
    expect(out).toEqual({
      DATABASE_URL: REMOTE,
      DIRECT_DATABASE_URL: REMOTE_OWNER,
      redirected: [],
    });
  });

  it("uses ISOLATION_DATABASE_URL for both roles when no direct override is given", () => {
    const out = resolveIsolationDatabaseEnv({ ISOLATION_DATABASE_URL: REMOTE });
    expect(out.DIRECT_DATABASE_URL).toBe(REMOTE);
  });
});

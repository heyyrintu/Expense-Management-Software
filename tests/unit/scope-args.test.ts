import { describe, expect, it } from "vitest";
import { assertOrgId, scopeArgs, TENANT_MODELS } from "@/lib/db/scope-args";

const ORG_A = "0198c5f2-0000-7000-8000-000000000aaa";
const ORG_B = "0198c5f2-0000-7000-8000-000000000bbb";

describe("scopeArgs — tenant models", () => {
  it("ANDs orgId into findMany where (caller filter preserved)", () => {
    const out = scopeArgs("Expense", "findMany", { where: { merchant: "Uber" } }, ORG_A);
    expect(out.where).toEqual({ AND: [{ merchant: "Uber" }, { orgId: ORG_A }] });
  });

  it("scopes an empty findMany", () => {
    const out = scopeArgs("Expense", "findMany", undefined, ORG_A);
    expect(out.where).toEqual({ AND: [{}, { orgId: ORG_A }] });
  });

  it("cannot be widened by a caller-supplied foreign orgId (AND keeps both)", () => {
    const out = scopeArgs("Expense", "findMany", { where: { orgId: ORG_B } }, ORG_A);
    // both conditions apply — result set is empty rather than cross-tenant
    expect(out.where).toEqual({ AND: [{ orgId: ORG_B }, { orgId: ORG_A }] });
  });

  // A smuggled orgId used to be OVERWRITTEN with the session org, which
  // turned "read A's row" into "read my own row" and returned data. ANDing
  // makes the two conditions contradict, so the query matches nothing —
  // the request is refused rather than quietly answered differently.
  it("refuses a smuggled orgId on unique where (findUnique/update/delete)", () => {
    for (const op of ["findUnique", "findUniqueOrThrow", "update", "delete"]) {
      const out = scopeArgs("ExpenseReport", op, { where: { id: "x", orgId: ORG_B } }, ORG_A);
      expect(out.where).toEqual({ id: "x", orgId: ORG_B, AND: [{ orgId: ORG_A }] });
    }
  });

  it("scopes a unique where that names no orgId", () => {
    const out = scopeArgs("ExpenseReport", "findUnique", { where: { id: "x" } }, ORG_A);
    expect(out.where).toEqual({ id: "x", orgId: ORG_A, AND: [{ orgId: ORG_A }] });
  });

  it("stamps orgId on create data", () => {
    const out = scopeArgs("Expense", "create", { data: { amount: 100, orgId: ORG_B } }, ORG_A);
    expect((out.data as Record<string, unknown>).orgId).toBe(ORG_A);
  });

  it("stamps orgId on every createMany row", () => {
    const out = scopeArgs("Expense", "createMany", { data: [{ a: 1 }, { a: 2 }] }, ORG_A);
    expect(out.data).toEqual([{ a: 1, orgId: ORG_A }, { a: 2, orgId: ORG_A }]);
  });

  it("scopes upsert where AND create", () => {
    const out = scopeArgs(
      "Category",
      "upsert",
      { where: { id: "x" }, create: { name: "Travel" }, update: { name: "Travel" } },
      ORG_A
    );
    expect(out.where).toEqual({ id: "x", orgId: ORG_A, AND: [{ orgId: ORG_A }] });
    // create is still STAMPED, not ANDed: a row has to be born in the
    // session's org, and there is nothing to contradict on the way in.
    expect(out.create).toEqual({ name: "Travel", orgId: ORG_A });
    expect(out.update).toEqual({ name: "Travel" }); // update untouched — row already scoped by where
  });

  it("scopes updateMany/deleteMany/count/aggregate/groupBy", () => {
    for (const op of ["updateMany", "deleteMany", "count", "aggregate", "groupBy"]) {
      const out = scopeArgs("AuditLog", op, { where: { action: "x" } }, ORG_A);
      expect(out.where).toEqual({ AND: [{ action: "x" }, { orgId: ORG_A }] });
    }
  });

  it("covers every tenant model", () => {
    for (const model of TENANT_MODELS) {
      const out = scopeArgs(model, "findMany", {}, ORG_A);
      expect(out.where).toEqual({ AND: [{}, { orgId: ORG_A }] });
    }
  });
});

describe("scopeArgs — Organization", () => {
  it("scopes reads by id, not orgId", () => {
    expect(scopeArgs("Organization", "findUnique", { where: { slug: "acme" } }, ORG_A).where)
      .toEqual({ slug: "acme", id: ORG_A, AND: [{ id: ORG_A }] });
    expect(scopeArgs("Organization", "findMany", {}, ORG_A).where)
      .toEqual({ AND: [{}, { id: ORG_A }] });
  });

  // The scope is ANDed on rather than assigned over the caller's id. The
  // difference only shows when the two disagree, which is exactly the case
  // that matters: `{ ...where, id: orgId }` would REWRITE "update org B"
  // into "update my own org" and report success, so a mis-scoped call would
  // corrupt the caller's own row instead of failing. ANDing yields a where
  // that matches nothing, and Prisma raises not-found.
  it("refuses another org's id rather than retargeting it at your own", () => {
    const out = scopeArgs(
      "Organization",
      "update",
      { where: { id: ORG_B }, data: { name: "x" } },
      ORG_A
    );
    expect(out.where).toEqual({ id: ORG_B, AND: [{ id: ORG_A }] });
    // the caller's id survives — it is not silently swapped for ORG_A
    expect((out.where as { id: string }).id).toBe(ORG_B);
  });

  it("still scopes a read that names no id", () => {
    const out = scopeArgs("Organization", "findUnique", { where: {} }, ORG_A);
    expect(out.where).toEqual({ id: ORG_A, AND: [{ id: ORG_A }] });
  });

  it("forbids org create/delete/upsert from a tenant scope", () => {
    for (const op of ["create", "createMany", "delete", "deleteMany", "upsert"]) {
      expect(() => scopeArgs("Organization", op, {}, ORG_A)).toThrow();
    }
  });
});

describe("scopeArgs — SuperAdmin", () => {
  it("is unreachable from a tenant scope", () => {
    for (const op of ["findMany", "findUnique", "create", "update", "delete"]) {
      expect(() => scopeArgs("SuperAdmin", op, {}, ORG_A)).toThrow(/platform-level/);
    }
  });
});

describe("assertOrgId", () => {
  it("accepts a UUID", () => {
    expect(() => assertOrgId(ORG_A)).not.toThrow();
  });
  it("rejects injection-shaped input", () => {
    for (const bad of ["", "1", "acme", "x'; DROP TABLE users;--"]) {
      expect(() => assertOrgId(bad)).toThrow();
    }
  });
});

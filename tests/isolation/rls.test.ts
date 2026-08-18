// Defense-in-depth: Postgres RLS must hold even if application scoping is
// bypassed entirely (raw SQL on the app-role connection).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { owner, provisionOrg, teardownOrgs, type OrgFixture } from "./helpers";

// App-role connection (DATABASE_URL) with NO scopedDb involved.
const appRaw = new PrismaClient();

let A: OrgFixture;
let B: OrgFixture;

beforeAll(async () => {
  A = await provisionOrg("rls-a");
  B = await provisionOrg("rls-b");
});

afterAll(async () => {
  await teardownOrgs([A.orgId, B.orgId]);
  await appRaw.$disconnect();
  await owner.$disconnect();
});

describe("RLS on the app role", () => {
  it("ground truth: fixtures exist (owner sees them)", async () => {
    expect(await owner.user.count({ where: { orgId: A.orgId } })).toBe(4);
  });

  it("without app.current_org_id, the app role sees zero tenant rows", async () => {
    const rows = await appRaw.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM users`;
    expect(Number(rows[0].n)).toBe(0);
  });

  it("with app.current_org_id = A, the app role sees only A", async () => {
    const [, rows] = await appRaw.$transaction([
      appRaw.$executeRaw`SELECT set_config('app.current_org_id', ${A.orgId}, TRUE)`,
      appRaw.$queryRaw<{ org_id: string }[]>`SELECT org_id::text AS org_id FROM users`,
    ]);
    expect(rows.length).toBe(4);
    for (const r of rows) expect(r.org_id).toBe(A.orgId);
  });

  it("cross-org raw INSERT is rejected by RLS WITH CHECK", async () => {
    await expect(
      appRaw.$transaction([
        appRaw.$executeRaw`SELECT set_config('app.current_org_id', ${B.orgId}, TRUE)`,
        appRaw.$executeRaw`INSERT INTO departments (id, org_id, name, created_at, updated_at)
          VALUES (gen_random_uuid(), ${A.orgId}::uuid, 'rls-smuggle', now(), now())`,
      ])
    ).rejects.toThrow();
    expect(
      await owner.department.count({ where: { orgId: A.orgId, name: "rls-smuggle" } })
    ).toBe(0);
  });
});

describe("RLS coverage (every tenant table, forever)", () => {
  it("every table with org_id has RLS enabled, forced, and a tenant_isolation policy", async () => {
    const tenantTables = await owner.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'org_id'`;
    expect(tenantTables.length).toBeGreaterThanOrEqual(10);

    type RlsRow = {
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      has_policy: boolean;
    };
    const status = await owner.$queryRaw<RlsRow[]>`
      SELECT c.relname,
             c.relrowsecurity,
             c.relforcerowsecurity,
             EXISTS (
               SELECT 1 FROM pg_policies p
               WHERE p.schemaname = 'public'
                 AND p.tablename = c.relname
                 AND p.policyname = 'tenant_isolation'
             ) AS has_policy
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = ANY (${tenantTables.map((t: { table_name: string }) => t.table_name)})`;

    const uncovered = status.filter(
      (s: RlsRow) => !(s.relrowsecurity && s.relforcerowsecurity && s.has_policy)
    );
    expect(
      uncovered.map((s: RlsRow) => s.relname),
      "tables with org_id but incomplete RLS — add the policy in your migration (db-migration skill step 3)"
    ).toEqual([]);
  });
});

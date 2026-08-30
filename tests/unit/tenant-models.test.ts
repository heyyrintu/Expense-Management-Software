// TENANT_MODELS is read as documentation of what carries org_id, and it had
// drifted: the per-diem and accounting work added four models and none were
// listed. scopeArgs fails closed for unknown models so nothing leaked, but a
// list that is only mostly true is worse than no list. This reads the schema
// and holds it honest.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TENANT_MODELS } from "@/lib/db/scope-args";

function tenantModelsInSchema(): string[] {
  const schema = readFileSync(
    join(process.cwd(), "prisma", "schema.prisma"),
    "utf8"
  );
  const found: string[] = [];
  for (const m of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    if (/\n\s*orgId\s+String[^\n]*@map\("org_id"\)/.test(m[2])) found.push(m[1]);
  }
  return found.sort();
}

describe("TENANT_MODELS", () => {
  it("lists every model in the schema that carries org_id", () => {
    expect([...TENANT_MODELS].sort()).toEqual(tenantModelsInSchema());
  });

  it("excludes the two models that are not tenant-scoped", () => {
    expect(TENANT_MODELS).not.toContain("Organization");
    expect(TENANT_MODELS).not.toContain("SuperAdmin");
  });
});

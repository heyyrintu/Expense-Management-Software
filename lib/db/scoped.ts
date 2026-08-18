// scopedDb(orgId) — THE way to touch tenant data.
//
// Two layers, both per query:
//   1. App scoping: scopeArgs() injects/enforces orgId in where/create.
//   2. Postgres RLS: every operation runs in a transaction that first
//      sets `app.current_org_id`, so the tenant_isolation policies apply
//      (defense-in-depth; pattern from Prisma's row-level-security
//      client-extension example).
//
// orgId ALWAYS comes from the server session — never from request
// params, body, or headers.
import type { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { assertOrgId, scopeArgs } from "./scope-args";

export function scopedDb(orgId: string) {
  assertOrgId(orgId);

  return prisma.$extends({
    name: "scopedDb",
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          const scoped = scopeArgs(model, operation, args, orgId);
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, TRUE)`,
            query(scoped) as Prisma.PrismaPromise<unknown>,
          ]);
          return result;
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedDb>;

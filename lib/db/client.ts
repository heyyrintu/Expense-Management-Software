// Raw Prisma client — module-private by convention.
//
// NEVER import this from route handlers, server actions, or server
// components. All tenant data access goes through scopedDb(orgId)
// (lib/db/scoped.ts). The only legitimate direct consumers are:
//   - lib/db/scoped.ts
//   - org-lifecycle flows that predate a session (org signup, in lib/db/)
//   - lib/auth/config.ts (slug -> org resolution before a session exists;
//     the user lookup itself still goes through scopedDb; super-admin auth)
//   - app/super/* (platform panel: cross-org AGGREGATES + org status only —
//     never tenant expense data; every support write is audit-logged)
//   - app/api/jobs/* (cron: org-ID iteration only; per-org work via scopedDb)
//   - prisma/seed.ts and test harnesses
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

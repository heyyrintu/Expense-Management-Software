// Raw Prisma client — module-private by convention.
//
// NEVER import this from route handlers, server actions, or server
// components. All tenant data access goes through scopedDb(orgId)
// (lib/db/scoped.ts). The only legitimate direct consumers are:
//   - lib/db/scoped.ts
//   - org-lifecycle flows that predate a session (org signup, in lib/db/)
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

// Org signup — the one flow that legitimately creates an Organization
// (no session exists yet, so scopedDb cannot be used). Runs as the app
// role: the org insert is allowed (organizations has no RLS) and the
// user insert passes RLS because app.current_org_id is set inside the
// same transaction, immediately after the org row exists.
import type { PrismaClient } from "@prisma/client";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { prisma } from "./client";

/** Prisma unique-constraint violation (works without instanceof on the
 *  generated error class, which isn't available until `prisma generate`). */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

export async function createOrgWithAdmin(input: {
  orgName: string;
  slug: string;
  adminName: string;
  email: string;
  passwordHash: string;
}): Promise<Result<{ orgId: string }>> {
  try {
    const orgId = await prisma.$transaction(async (txRaw: unknown) => {
      const tx = txRaw as PrismaClient;
      const org = await tx.organization.create({
        data: { name: input.orgName, slug: input.slug },
        select: { id: true },
      });
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org.id}, TRUE)`;
      await tx.user.create({
        data: {
          orgId: org.id,
          name: input.adminName,
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          role: "org_admin",
          status: "active",
        },
      });
      return org.id;
    });
    return ok({ orgId });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return err(userErrors.slugTaken);
    }
    throw e;
  }
}

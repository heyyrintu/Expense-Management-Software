"use server";

// Super-admin actions (PRD 6.1b). Raw client by design (platform-level,
// documented in lib/db/client.ts) — aggregates and org status ONLY; every
// support write lands in the affected org's AuditLog.
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { AuthorizationError, requireSuperAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { checkRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { superLoginSchema } from "@/lib/schemas/auth";
import { z } from "zod";

const orgActionSchema = z.object({ orgId: z.string().uuid() });

export async function superLoginAction(input: unknown): Promise<Result> {
  const parsed = superLoginSchema.safeParse(input);
  if (!parsed.success) return err(userErrors.validation);
  if (!checkRateLimit("login", `super:${parsed.data.email.toLowerCase()}`)) {
    return err(rateLimitedMessage);
  }
  try {
    await signIn("super-credentials", {
      ...parsed.data,
      redirectTo: "/super",
    });
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthError) return err(userErrors.invalidCredentials);
    throw e; // NEXT_REDIRECT on success
  }
}

async function setOrgStatus(
  input: unknown,
  status: "active" | "suspended"
): Promise<Result> {
  try {
    const admin = await requireSuperAdmin();
    const parsed = orgActionSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const res = await prisma.organization.updateMany({
      where: { id: parsed.data.orgId, status: status === "active" ? "suspended" : "active" },
      data: { status },
    });
    if (res.count === 0) return err("Organization not found or already in that state.");

    // support access is logged into the affected org's audit trail
    await prisma.auditLog.create({
      data: {
        orgId: parsed.data.orgId,
        entity: "Organization",
        entityId: parsed.data.orgId,
        actorId: null, // platform action — actor recorded in meta
        action: status === "suspended" ? "org.suspended" : "org.unsuspended",
        meta: { superAdmin: admin.email },
      },
    });
    revalidatePath("/super");
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthorizationError) return err(e.message);
    throw e;
  }
}

export async function suspendOrgAction(input: unknown): Promise<Result> {
  return setOrgStatus(input, "suspended");
}

export async function unsuspendOrgAction(input: unknown): Promise<Result> {
  return setOrgStatus(input, "active");
}

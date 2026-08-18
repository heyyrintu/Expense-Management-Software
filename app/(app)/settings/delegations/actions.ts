"use server";

// Delegation management (6.5) — org_admin only.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
  requireSession,
} from "@/lib/auth/guard";
import { ACTING_COOKIE } from "@/lib/auth/acting";
import { logAudit } from "@/lib/domain/audit";
import { isValidDelegationPair } from "@/lib/domain/delegation";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { z } from "zod";

const pairSchema = z.object({
  delegateId: z.string().uuid(),
  principalId: z.string().uuid(),
});
const idSchema = z.object({ id: z.string().uuid() });

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

function isPrismaCode(e: unknown, code: string): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e &&
    (e as { code?: unknown }).code === code
  );
}

export async function createDelegationAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = pairSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    if (!isValidDelegationPair(parsed.data.delegateId, parsed.data.principalId)) {
      return err("A user can't be their own delegate.");
    }

    const db = scopedDb(ctx.orgId);
    for (const uid of [parsed.data.delegateId, parsed.data.principalId]) {
      const u = await db.user.findUnique({ where: { id: uid }, select: { status: true } });
      if (!u || u.status !== "active") return err("Both users must be active members.");
    }

    const delegation = await db.delegation.upsert({
      where: {
        orgId_delegateId_principalId: {
          orgId: ctx.orgId,
          delegateId: parsed.data.delegateId,
          principalId: parsed.data.principalId,
        },
      },
      update: { active: true },
      create: {
        orgId: ctx.orgId,
        delegateId: parsed.data.delegateId,
        principalId: parsed.data.principalId,
      },
    });
    await logAudit(db, ctx, {
      entity: "Delegation",
      entityId: delegation.id,
      action: "delegation.created",
      meta: { delegateId: parsed.data.delegateId, principalId: parsed.data.principalId },
    });
    revalidatePath("/settings/delegations");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2002")) return err("That delegation already exists.");
    throw e;
  }
}

export async function deactivateDelegationAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const db = scopedDb(ctx.orgId);
    const res = await db.delegation.updateMany({
      where: { id: parsed.data.id, active: true },
      data: { active: false },
    });
    if (res.count === 0) return err("Delegation not found.");
    await logAudit(db, ctx, {
      entity: "Delegation",
      entityId: parsed.data.id,
      action: "delegation.deactivated",
    });
    revalidatePath("/settings/delegations");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

/** Delegate switches into (or out of) acting-as mode. */
export async function setActingAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = z
      .object({ principalId: z.union([z.literal(""), z.string().uuid()]) })
      .safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const jar = await cookies();

    if (parsed.data.principalId === "") {
      jar.delete(ACTING_COOKIE);
      return ok(undefined);
    }
    const delegation = await scopedDb(ctx.orgId).delegation.findFirst({
      where: { delegateId: ctx.userId, principalId: parsed.data.principalId, active: true },
    });
    if (!delegation) return err("You don't have delegate access for that user.");
    jar.set(ACTING_COOKIE, parsed.data.principalId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

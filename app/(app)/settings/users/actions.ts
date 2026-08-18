"use server";

// User management (task 2.0) — org_admin only. Every query via scopedDb;
// orgId/actor from session; AuditLog on invite, role/approver change,
// deactivate/reactivate, revoke.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { createInviteToken } from "@/lib/auth/invite-token";
import type { Role } from "@/lib/auth/roles";
import { logAudit } from "@/lib/domain/audit";
import {
  isValidApproverAssignment,
  leavesOrgAdminPool,
  wouldRemoveLastOrgAdmin,
} from "@/lib/domain/users";
import { scopedDb, type ScopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import {
  editUserSchema,
  inviteUserSchema,
  userIdSchema,
} from "@/lib/schemas/user";

const LAST_ADMIN = "An organization needs at least one active org admin.";
const SELF_APPROVER = "A user can't be their own approver.";

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

function isPrismaCode(e: unknown, code: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === code
  );
}

function inviteLink(userId: string, orgId: string): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/${createInviteToken(userId, orgId)}`;
}

async function activeOrgAdminIds(db: ScopedDb, orgId: string): Promise<string[]> {
  const admins = await db.user.findMany({
    where: { orgId, role: "org_admin", status: "active" },
    select: { id: true },
  });
  return admins.map((a: { id: string }) => a.id);
}

async function assertValidRefs(
  db: ScopedDb,
  input: { departmentId: string; approverId: string },
  targetUserId: string | null
): Promise<string | null> {
  if (input.departmentId) {
    const dept = await db.department.findUnique({ where: { id: input.departmentId } });
    if (!dept) return "Pick a valid department.";
  }
  if (input.approverId) {
    if (targetUserId && !isValidApproverAssignment(targetUserId, input.approverId)) {
      return SELF_APPROVER;
    }
    const approver = await db.user.findUnique({
      where: { id: input.approverId },
      select: { status: true },
    });
    if (!approver || approver.status !== "active") {
      return "The assigned approver must be an active user.";
    }
  }
  return null;
}

export async function inviteUserAction(
  input: unknown
): Promise<Result<{ id: string; inviteLink: string }>> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = inviteUserSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const { name, email, role, departmentId, approverId } = parsed.data;

    const db = scopedDb(ctx.orgId);
    const refErr = await assertValidRefs(db, { departmentId, approverId }, null);
    if (refErr) return err(refErr);

    try {
      const user = await db.user.create({
        data: {
          orgId: ctx.orgId,
          name,
          email: email.toLowerCase(),
          role: role as Role,
          status: "invited",
          departmentId: departmentId || null,
          approverId: approverId || null,
        },
      });
      await logAudit(db, ctx, {
        entity: "User",
        entityId: user.id,
        action: "user.invited",
        meta: { email: email.toLowerCase(), role },
      });
      revalidatePath("/settings/users");
      return ok({ id: user.id, inviteLink: inviteLink(user.id, ctx.orgId) });
    } catch (e) {
      if (isPrismaCode(e, "P2002")) return err(userErrors.emailTaken);
      throw e;
    }
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ id: string; inviteLink: string }>;
    throw e;
  }
}

export async function resendInviteAction(
  input: unknown
): Promise<Result<{ inviteLink: string }>> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = userIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const user = await db.user.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, status: true },
    });
    if (!user || user.status !== "invited") {
      return err("Only pending invites can be re-sent.");
    }
    await logAudit(db, ctx, {
      entity: "User",
      entityId: user.id,
      action: "user.invite_resent",
    });
    return ok({ inviteLink: inviteLink(user.id, ctx.orgId) });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ inviteLink: string }>;
    throw e;
  }
}

export async function revokeInviteAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = userIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    // hard delete is fine ONLY for never-activated invites (no data yet)
    const res = await db.user.deleteMany({
      where: { id: parsed.data.id, status: "invited" },
    });
    if (res.count === 0) return err("Only pending invites can be revoked.");

    await logAudit(db, ctx, {
      entity: "User",
      entityId: parsed.data.id,
      action: "user.invite_revoked",
    });
    revalidatePath("/settings/users");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function updateUserAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = editUserSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const { id, role, departmentId, approverId } = parsed.data;

    const db = scopedDb(ctx.orgId);
    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
    if (!target) return err("User not found.");

    const refErr = await assertValidRefs(db, { departmentId, approverId }, id);
    if (refErr) return err(refErr);

    if (
      leavesOrgAdminPool(
        { role: target.role as Role, status: target.status },
        { role: role as Role, status: target.status }
      ) &&
      wouldRemoveLastOrgAdmin(id, await activeOrgAdminIds(db, ctx.orgId))
    ) {
      return err(LAST_ADMIN);
    }

    await db.user.update({
      where: { id },
      data: {
        role: role as Role,
        departmentId: departmentId || null,
        approverId: approverId || null,
      },
    });
    await logAudit(db, ctx, {
      entity: "User",
      entityId: id,
      action: "user.updated",
      meta: {
        role,
        departmentId: departmentId || null,
        approverId: approverId || null,
        previousRole: target.role,
      },
    });
    revalidatePath("/settings/users");
    revalidatePath(`/settings/users/${id}`);
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function deactivateUserAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = userIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const { id } = parsed.data;

    const db = scopedDb(ctx.orgId);
    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
    if (!target || target.status !== "active") {
      return err("Only active users can be deactivated.");
    }
    if (
      target.role === "org_admin" &&
      wouldRemoveLastOrgAdmin(id, await activeOrgAdminIds(db, ctx.orgId))
    ) {
      return err(LAST_ADMIN);
    }

    // login is refused for non-active users in lib/auth/config.ts authorize();
    // historical expenses/reports keep their rows and stay visible to finance
    await db.user.update({ where: { id }, data: { status: "deactivated" } });
    await logAudit(db, ctx, {
      entity: "User",
      entityId: id,
      action: "user.deactivated",
    });
    revalidatePath("/settings/users");
    revalidatePath(`/settings/users/${id}`);
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function reactivateUserAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = userIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.user.updateMany({
      where: { id: parsed.data.id, status: "deactivated" },
      data: { status: "active" },
    });
    if (res.count === 0) return err("Only deactivated users can be reactivated.");

    await logAudit(db, ctx, {
      entity: "User",
      entityId: parsed.data.id,
      action: "user.reactivated",
    });
    revalidatePath("/settings/users");
    revalidatePath(`/settings/users/${parsed.data.id}`);
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

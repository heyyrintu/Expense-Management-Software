"use server";

// Departments CRUD (task 2.0) — org_admin only.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import {
  departmentEditSchema,
  departmentIdSchema,
  departmentSchema,
} from "@/lib/schemas/user";

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

const NAME_TAKEN = "A department with that name already exists.";

export async function createDepartmentAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = departmentSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const dept = await db.department.create({
      data: { orgId: ctx.orgId, name: parsed.data.name },
    });
    await logAudit(db, ctx, {
      entity: "Department",
      entityId: dept.id,
      action: "department.created",
      meta: { name: parsed.data.name },
    });
    revalidatePath("/settings/departments");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2002")) return err(NAME_TAKEN);
    throw e;
  }
}

export async function renameDepartmentAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = departmentEditSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    await db.department.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name },
    });
    await logAudit(db, ctx, {
      entity: "Department",
      entityId: parsed.data.id,
      action: "department.renamed",
      meta: { name: parsed.data.name },
    });
    revalidatePath("/settings/departments");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2025")) return err("Department not found.");
    if (isPrismaCode(e, "P2002")) return err(NAME_TAKEN);
    throw e;
  }
}

export async function deleteDepartmentAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = departmentIdSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const users = await db.user.count({
      where: { departmentId: parsed.data.id },
    });
    if (users > 0) {
      return err("Move its users to another department first.");
    }
    const res = await db.department.deleteMany({ where: { id: parsed.data.id } });
    if (res.count === 0) return err("Department not found.");

    await logAudit(db, ctx, {
      entity: "Department",
      entityId: parsed.data.id,
      action: "department.deleted",
    });
    revalidatePath("/settings/departments");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

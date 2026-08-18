"use server";

// Billing-client CRUD (6.3) — finance_admin+.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  code: z.string().trim().min(1, "Code is required").max(20).toUpperCase(),
});
const clientEditSchema = clientSchema.extend({ id: z.string().uuid() });
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
const TAKEN = "A client with that name or code already exists.";

export async function createClientAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const db = scopedDb(ctx.orgId);
    const client = await db.client.create({
      data: { orgId: ctx.orgId, ...parsed.data },
    });
    await logAudit(db, ctx, {
      entity: "Client",
      entityId: client.id,
      action: "client.created",
      meta: parsed.data,
    });
    revalidatePath("/settings/clients");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2002")) return err(TAKEN);
    throw e;
  }
}

export async function updateClientAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = clientEditSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const { id, ...data } = parsed.data;
    const db = scopedDb(ctx.orgId);
    const res = await db.client.updateMany({ where: { id }, data });
    if (res.count === 0) return err("Client not found.");
    await logAudit(db, ctx, {
      entity: "Client",
      entityId: id,
      action: "client.updated",
      meta: data,
    });
    revalidatePath("/settings/clients");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    if (isPrismaCode(e, "P2002")) return err(TAKEN);
    throw e;
  }
}

export async function deleteClientAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("finance_admin");
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const db = scopedDb(ctx.orgId);
    const inUse = await db.expense.count({ where: { clientId: parsed.data.id } });
    if (inUse > 0) return err("This client has billable expenses and can't be deleted.");
    const res = await db.client.deleteMany({ where: { id: parsed.data.id } });
    if (res.count === 0) return err("Client not found.");
    await logAudit(db, ctx, {
      entity: "Client",
      entityId: parsed.data.id,
      action: "client.deleted",
    });
    revalidatePath("/settings/clients");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

"use server";

// Approval-chain rule CRUD (5.4) — org_admin only; all referenced users and
// departments must resolve inside the org scope.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { parseToMinorUnits } from "@/lib/money";
import { optionalMoneyString } from "@/lib/schemas/category";
import { z } from "zod";

const ruleSchema = z.object({
  name: z.string().trim().min(1, "Give the rule a name").max(80),
  departmentId: z.union([z.literal(""), z.string().uuid()]),
  aboveAmount: optionalMoneyString,
  approverId: z.string().uuid("Pick an approver"),
  secondApproverId: z.union([z.literal(""), z.string().uuid()]),
});
const idSchema = z.object({ id: z.string().uuid() });

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

export async function createApprovalRuleAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const d = parsed.data;

    const aboveAmount = d.aboveAmount === "" ? null : parseToMinorUnits(d.aboveAmount);
    if (d.aboveAmount !== "" && aboveAmount === null) return err(userErrors.validation);
    if (d.secondApproverId && d.secondApproverId === d.approverId) {
      return err("The two approvers must be different people.");
    }

    const db = scopedDb(ctx.orgId);
    if (d.departmentId) {
      const dept = await db.department.findUnique({ where: { id: d.departmentId } });
      if (!dept) return err("Pick a valid department.");
    }
    for (const uid of [d.approverId, d.secondApproverId].filter(Boolean) as string[]) {
      const u = await db.user.findUnique({
        where: { id: uid },
        select: { status: true, role: true },
      });
      if (!u || u.status !== "active" || u.role === "employee") {
        return err("Approvers must be active users with the approver role or higher.");
      }
    }

    const rule = await db.approvalRule.create({
      data: {
        orgId: ctx.orgId,
        name: d.name,
        departmentId: d.departmentId || null,
        aboveAmount,
        approverId: d.approverId,
        secondApproverId: d.secondApproverId || null,
      },
    });
    await logAudit(db, ctx, {
      entity: "ApprovalRule",
      entityId: rule.id,
      action: "approval_rule.created",
      meta: { name: d.name, departmentId: d.departmentId || null, aboveAmount },
    });
    revalidatePath("/settings/approval-chains");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function deleteApprovalRuleAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("org_admin");
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.approvalRule.deleteMany({ where: { id: parsed.data.id } });
    if (res.count === 0) return err("Rule not found.");

    await logAudit(db, ctx, {
      entity: "ApprovalRule",
      entityId: parsed.data.id,
      action: "approval_rule.deleted",
    });
    revalidatePath("/settings/approval-chains");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

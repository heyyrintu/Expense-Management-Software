"use server";

// Approval decisions (task 2.2). All transitions via report-workflow's
// nextStatus(); Approval + AuditLog rows on every decision; self-approval
// structurally impossible via canDecideAtLevel().
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
} from "@/lib/auth/guard";
import { decideReport } from "@/lib/domain/report-decision";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { bulkApproveSchema, decisionSchema } from "@/lib/schemas/approval";

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

export async function decideReportAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("approver");
    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);
    const res = await decideReport(ctx, parsed.data);
    if (res.ok) {
      revalidatePath("/approvals");
      revalidatePath(`/approvals/${parsed.data.reportId}`);
      revalidatePath("/reports");
    }
    return res;
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function bulkApproveAction(
  input: unknown
): Promise<Result<{ approved: number; skipped: number }>> {
  try {
    const ctx = await requireRole("approver");
    const parsed = bulkApproveSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    let approved = 0;
    let skipped = 0;
    for (const reportId of parsed.data.reportIds) {
      const res = await decideReport(
        ctx,
        { reportId, action: "approve" },
        { requireUnflagged: true }
      );
      if (res.ok) approved += 1;
      else skipped += 1;
    }
    revalidatePath("/approvals");
    revalidatePath("/reports");
    return ok({ approved, skipped });
  } catch (e) {
    const g = guardError(e);
    if (g) return g as Result<{ approved: number; skipped: number }>;
    throw e;
  }
}

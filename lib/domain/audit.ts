// Append-only audit trail. Call after every state change (CLAUDE.md).
// Uses the caller's scopedDb so org stamping + RLS apply.
import type { ScopedDb } from "@/lib/db/scoped";
import type { SessionCtx } from "@/lib/auth/guard";

export type AuditEntry = {
  entity:
    | "Organization"
    | "User"
    | "Department"
    | "Project"
    | "Category"
    | "Expense"
    | "Receipt"
    | "ExpenseReport"
    | "Approval"
    | "Reimbursement"
    | "Budget"
    | "CardTransaction";
  entityId: string;
  action: string; // dot-namespaced, e.g. "category.created"
  meta?: Record<string, unknown>;
};

export async function logAudit(
  db: ScopedDb,
  ctx: SessionCtx,
  entry: AuditEntry
): Promise<void> {
  await db.auditLog.create({
    data: {
      orgId: ctx.orgId, // stamped by scopedDb regardless; satisfies the generated types
      entity: entry.entity,
      entityId: entry.entityId,
      actorId: ctx.userId,
      action: entry.action,
      meta: entry.meta ?? {},
    },
  });
}

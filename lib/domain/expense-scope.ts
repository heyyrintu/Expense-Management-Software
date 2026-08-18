// Resolve the widest expense scope a session may use (server-side, from the
// role — never from client input).
import type { SessionCtx } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import type { ScopedDb } from "@/lib/db/scoped";
import type { ExpenseScope } from "./expense-query";

export async function resolveExpenseScope(
  db: ScopedDb,
  ctx: SessionCtx
): Promise<ExpenseScope> {
  if (roleAtLeast(ctx.role, "finance_admin")) return { kind: "org" };
  if (roleAtLeast(ctx.role, "approver")) {
    const reports = (await db.user.findMany({
      where: { approverId: ctx.userId },
      select: { id: true },
    })) as Array<{ id: string }>;
    return {
      kind: "team",
      teamUserIds: [ctx.userId, ...reports.map((u) => u.id)],
    };
  }
  return { kind: "employee", userId: ctx.userId };
}

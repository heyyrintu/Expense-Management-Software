// Report-thread permission rule (5.3) — pure.
// The thread is between the report owner and the approval side: owner, or
// anyone with role >= approver in the same org (assigned approver, second-
// level finance, org admin).
import { roleAtLeast, type Role } from "@/lib/auth/roles";

export function canCommentOnReport(input: {
  actorId: string;
  actorRole: Role;
  ownerId: string;
}): boolean {
  if (input.actorId === input.ownerId) return true;
  return roleAtLeast(input.actorRole, "approver");
}

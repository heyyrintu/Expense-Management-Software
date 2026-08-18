// Pure user-management rules — unit-tested in tests/unit/users-domain.test.ts.
import type { Role } from "@/lib/auth/roles";

export type ManagedUser = {
  id: string;
  role: Role;
  status: "invited" | "active" | "deactivated";
};

/**
 * True when removing/demoting/deactivating `targetId` would leave the org
 * with no active org_admin. `activeOrgAdminIds` = ids of ACTIVE org_admins.
 */
export function wouldRemoveLastOrgAdmin(
  targetId: string,
  activeOrgAdminIds: string[]
): boolean {
  return activeOrgAdminIds.length === 1 && activeOrgAdminIds[0] === targetId;
}

/** A user can never be their own approver. */
export function isValidApproverAssignment(
  userId: string,
  approverId: string | null
): boolean {
  return approverId === null || approverId !== userId;
}

/** Whether an edit takes the target OUT of the active-org_admin pool. */
export function leavesOrgAdminPool(
  current: { role: Role; status: ManagedUser["status"] },
  next: { role: Role; status: ManagedUser["status"] }
): boolean {
  const wasActiveAdmin = current.role === "org_admin" && current.status === "active";
  const staysActiveAdmin = next.role === "org_admin" && next.status === "active";
  return wasActiveAdmin && !staysActiveAdmin;
}

// Role hierarchy: employee < approver < finance_admin < org_admin.
// Pure module — unit-tested in tests/unit/roles.test.ts.
// (String union mirrors the Prisma `role` enum values.)
export const ROLES = ["employee", "approver", "finance_admin", "org_admin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_ORDER: Record<Role, number> = {
  employee: 0,
  approver: 1,
  finance_admin: 2,
  org_admin: 3,
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/** True when `role` is at least as privileged as `min`. */
export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[min];
}

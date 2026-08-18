// Server-side authorization guards. EVERY route handler and server action
// must call one of these — UI hiding is not authorization (CLAUDE.md).
import { scopedDb } from "@/lib/db/scoped";
import { userErrors } from "@/lib/errors";
import { auth } from "./index";
import { isRole, roleAtLeast, type Role } from "./roles";

export class AuthenticationError extends Error {
  constructor() {
    super(userErrors.notAuthenticated);
    this.name = "AuthenticationError";
  }
}
export class AuthorizationError extends Error {
  constructor() {
    super(userErrors.notAuthorized);
    this.name = "AuthorizationError";
  }
}

export type SessionCtx = {
  userId: string;
  orgId: string;
  orgSlug: string;
  role: Role;
};

/** Null when unauthenticated — for pages that redirect themselves.
 *  Super-admin sessions are NOT tenant sessions (PRD 6.1b) and a suspended
 *  org's members lose access immediately, not just at next login. */
export async function getSessionCtx(): Promise<SessionCtx | null> {
  const session = await auth();
  if (!session?.userId || !session.orgId) return null;
  if (!isRole(session.role)) return null; // super_admin → no org data access
  const org = await scopedDb(session.orgId).organization.findUnique({
    where: { id: session.orgId },
    select: { status: true },
  });
  if (!org || org.status !== "active") return null;
  return {
    userId: session.userId,
    orgId: session.orgId,
    orgSlug: session.orgSlug,
    role: session.role,
  };
}

/** Throws AuthenticationError when there is no valid session. */
export async function requireSession(): Promise<SessionCtx> {
  const ctx = await getSessionCtx();
  if (!ctx) throw new AuthenticationError();
  return ctx;
}

/**
 * Throws unless the session role is at least `min` in the hierarchy
 * employee < approver < finance_admin < org_admin.
 */
export async function requireRole(min: Role): Promise<SessionCtx> {
  const ctx = await requireSession();
  if (!roleAtLeast(ctx.role, min)) throw new AuthorizationError();
  return ctx;
}

export type SuperAdminCtx = { superAdminId: string; email: string };

/** Platform operator session — throws for tenant users. */
export async function requireSuperAdmin(): Promise<SuperAdminCtx> {
  const session = await auth();
  if (!session?.userId || session.role !== "super_admin") {
    throw new AuthorizationError();
  }
  return { superAdminId: session.userId, email: session.user?.email ?? "" };
}

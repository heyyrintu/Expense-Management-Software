// Server-side authorization guards. EVERY route handler and server action
// must call one of these — UI hiding is not authorization (CLAUDE.md).
import { userErrors } from "@/lib/errors";
import { auth } from "./index";
import { roleAtLeast, type Role } from "./roles";

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

/** Null when unauthenticated — for pages that redirect themselves. */
export async function getSessionCtx(): Promise<SessionCtx | null> {
  const session = await auth();
  if (!session?.userId || !session.orgId) return null;
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

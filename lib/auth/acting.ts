// Acting-as (delegate) context (PLAN 6.5).
//
// The delegate's SESSION never changes — an httpOnly cookie holds the
// principal id and is RE-VALIDATED against an active same-org Delegation on
// every use. The effective user id applies ONLY to expense/report ownership;
// approvals always use the real identity, so delegation can never confer
// approval rights.
import { cookies } from "next/headers";
import type { SessionCtx } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";

export const ACTING_COOKIE = "acting-as";

export type ActingCtx = {
  /** ownership id for expenses/reports (principal when acting, else self) */
  effectiveUserId: string;
  /** set when acting: the principal's identity */
  onBehalfOf: { id: string; name: string } | null;
};

export async function resolveActing(ctx: SessionCtx): Promise<ActingCtx> {
  const jar = await cookies();
  const principalId = jar.get(ACTING_COOKIE)?.value;
  if (!principalId || principalId === ctx.userId) {
    return { effectiveUserId: ctx.userId, onBehalfOf: null };
  }
  // must be an ACTIVE delegation inside the session org — cookie is untrusted
  const delegation = await scopedDb(ctx.orgId).delegation.findFirst({
    where: { delegateId: ctx.userId, principalId, active: true },
    include: { principal: { select: { id: true, name: true, status: true } } },
  });
  if (!delegation || delegation.principal.status !== "active") {
    return { effectiveUserId: ctx.userId, onBehalfOf: null };
  }
  return {
    effectiveUserId: delegation.principal.id,
    onBehalfOf: { id: delegation.principal.id, name: delegation.principal.name },
  };
}

/** Audit meta fragment recording both identities (CLAUDE.md: dual identity). */
export function actingMeta(acting: ActingCtx): Record<string, unknown> {
  return acting.onBehalfOf ? { onBehalfOf: acting.onBehalfOf.id } : {};
}

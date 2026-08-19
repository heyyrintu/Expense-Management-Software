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

// ---------------------------------------------------------------------------
// Requested view scope (D3.3)
//
// §7.4 asks that every KPI click through to "its filtered table", and the
// number and the list must agree. A finance dashboard's "total spend" is
// org-wide, so before D3.3 there was nowhere for it to point: every list in
// this product — /expenses, /reports, /ledger — is pinned to ONE user. The
// card either linked to a list showing a fraction of its own figure, or it
// linked nowhere.
//
// So the expense list gained a view scope. The URL may REQUEST a width; the
// server decides the ceiling.
//
// ── THE URL CAN ONLY NARROW, NEVER WIDEN ──────────────────────────────────
// The ceiling is `resolveExpenseScope` above, derived from the session role
// and nothing else. `narrowViewScope` clamps the request to it, and
// `viewScopeWhere` builds the predicate from the CLAMPED value together with
// the ceiling object — so `?scope=org` from an employee is not an error to
// handle, it is arithmetic that cannot produce a wider predicate. An
// employee always ends at `{ userId: self }`, whatever the query string
// says. Proven in tests/unit/expense-scope.test.ts and, against a real
// database, tests/isolation/expense-scope.test.ts.
//
// This is scope, not a filter, which is why it lives here rather than in
// lib/schemas/expense-filters.ts: filters narrow a scope, and something that
// could widen one must never travel in the same bag.
// ---------------------------------------------------------------------------

export const EXPENSE_VIEW_SCOPES = ["mine", "team", "org"] as const;
export type ExpenseViewScope = (typeof EXPENSE_VIEW_SCOPES)[number];

/** Read `?scope=` off the URL. Anything unrecognised falls back to "mine" —
 *  the narrowest view, so a mangled link under-shows rather than over-shows. */
export function parseViewScope(
  raw: string | string[] | undefined
): ExpenseViewScope {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (EXPENSE_VIEW_SCOPES as readonly string[]).includes(value ?? "")
    ? (value as ExpenseViewScope)
    : "mine";
}

/** What the session may actually see, given what it asked for. */
export function narrowViewScope(
  ceiling: ExpenseScope,
  requested: ExpenseViewScope
): ExpenseViewScope {
  if (ceiling.kind === "employee") return "mine";
  if (ceiling.kind === "team") return requested === "org" ? "team" : requested;
  return requested;
}

/**
 * The `where` fragment for a requested view.
 *
 * `selfId` is the ACTING user (delegation), because "mine" means the rows
 * whose owner the session is currently standing in for. Note this function
 * clamps again rather than trusting its caller to have called
 * `narrowViewScope` first: a security property enforced in one place that
 * callers must remember to use is a security property waiting to be missed.
 */
export function viewScopeWhere(
  ceiling: ExpenseScope,
  requested: ExpenseViewScope,
  selfId: string
): Record<string, unknown> {
  const scope = narrowViewScope(ceiling, requested);
  if (scope === "org") return {};
  if (scope === "team" && ceiling.kind === "team") {
    return { userId: { in: ceiling.teamUserIds } };
  }
  // "mine", and the defensive fallback for a team request under an org
  // ceiling — where there is no team list to widen to, so it stays pinned.
  return { userId: selfId };
}

/** Screen title and subtitle for a view. The reader must never have to guess
 *  whose expenses a total covers. */
export function viewScopeCopy(scope: ExpenseViewScope): {
  title: string;
  description: string;
} {
  switch (scope) {
    case "org":
      return {
        title: "All expenses",
        description: "Every expense in the organisation, newest first.",
      };
    case "team":
      return {
        title: "Team expenses",
        description: "You and everyone who reports to you.",
      };
    default:
      return {
        title: "My expenses",
        description:
          "Draft expenses can be edited until they join a submitted report.",
      };
  }
}

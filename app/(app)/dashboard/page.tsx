// Dashboards (D3.3) — DESIGN-PRD §7.4.
//
// One route, three screens. Which one you get is decided by the scope the
// server resolves from your role, never by a query parameter:
//
//   employee   my spend · awaiting approval · pending reimbursement · drafts
//   approver   the queue waiting on you, then the team's spend
//   finance    the four cards §7.4 names, org-wide
//
// ── WHY THIS FILE IS SHORT ─────────────────────────────────────────────────
// This page streams in two parts. Everything the header needs — the session,
// who the reader is acting as, the scope their role allows, and for an
// employee their name — is three small reads, so the title and description
// are sent as soon as those resolve. The aggregate queries that fill the KPI
// strip, the charts and the panels run behind a Suspense boundary
// (dashboard-body.tsx) and stream in after, over the body skeleton.
//
// Before the split the whole page sat behind route-level loading.tsx and the
// title arrived with the last byte. On a phone that made the largest text on
// screen wait for the slowest query — and Lighthouse, which cannot tell a
// streamed reveal from a hydration-gated one, charged every script the page
// loads against LCP. The header is plain server-rendered text; it should
// paint with the first paint, and now it does.
//
// The one where-clause (§7.4's "the number and the list must always agree")
// is computed HERE, once, and handed to both the header's action and the
// body, so the "Add expense" button and the empty state cannot disagree
// about whether there is anything to show. See dashboard-body.tsx for the
// rule itself.
// ──────────────────────────────────────────────────────────────────────────
import { Suspense } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { resolveActing } from "@/lib/auth/acting";
import { requireSession } from "@/lib/auth/guard";
import { scopedDb } from "@/lib/db/scoped";
import { applyExpenseFilters } from "@/lib/domain/expense-query";
import {
  narrowViewScope,
  resolveExpenseScope,
  viewScopeWhere,
  type ExpenseViewScope,
} from "@/lib/domain/expense-scope";
import { parseExpenseFilters } from "@/lib/schemas/expense-filters";
import { DashboardAction, DashboardBody } from "./dashboard-body";
import { DashboardBodySkeleton } from "./dashboard-skeleton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const acting = await resolveActing(ctx);
  const db = scopedDb(ctx.orgId);
  const filters = parseExpenseFilters(await searchParams);

  // Scope comes from the ROLE, server-side. Unlike /expenses there is no
  // `?scope=` here: a dashboard is the widest view its reader is entitled to,
  // and offering a narrower one would just be the filter bar with worse
  // wording.
  const ceiling = await resolveExpenseScope(db, ctx);
  const view: ExpenseViewScope = narrowViewScope(
    ceiling,
    ceiling.kind === "org" ? "org" : ceiling.kind === "team" ? "team" : "mine"
  );
  const scopeWhere = viewScopeWhere(ceiling, view, acting.effectiveUserId);

  // THE where-clause. Everything below is this, narrowed.
  const where = applyExpenseFilters(scopeWhere, filters);

  const isApprover = ceiling.kind !== "employee";
  const isFinance = ceiling.kind === "org";

  // Only the employee dashboard greets by name; the other two are titled by
  // what they show. One indexed read, and only when the title needs it.
  const user = isApprover
    ? null
    : await db.user.findUniqueOrThrow({
        where: { id: acting.effectiveUserId },
        select: { name: true },
      });

  const title = isFinance
    ? "Finance overview"
    : isApprover
      ? "Team overview"
      : `Welcome, ${user?.name}`;
  const description = isFinance
    ? "Every expense in the organisation. Each figure opens the list it was counted from."
    : isApprover
      ? "You and everyone who reports to you."
      : "Your spend, and what is still moving through approval.";

  const scope = { ctx, db, filters, view, scopeWhere, where, isApprover, isFinance };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <Suspense fallback={null}>
            <DashboardAction db={db} where={where} />
          </Suspense>
        }
      />
      <Suspense fallback={<DashboardBodySkeleton />}>
        <DashboardBody {...scope} />
      </Suspense>
    </>
  );
}

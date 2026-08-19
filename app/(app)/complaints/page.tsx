// Complaints (D4.3) — DESIGN-PRD §7.7, PLAN 7.3.
//
// Two screens behind one route, decided by role and nothing else:
//
//   finance_admin+  an INBOX — the shared DataTable, status/type/age facets,
//                   an SLA column and a danger edge on breached rows. It is a
//                   work queue, and a queue is a table.
//   everyone else   THEIR OWN disputes, as cards. Most employees have one or
//                   two ever; a seven-column table of two rows is a filing
//                   cabinet for a pair of letters.
//
// Both read the same lib/complaints/queries module, so the two views can
// never disagree about what a complaint is or how old it is.
import Link from "next/link";

import { AnimatedStatusBadge } from "@/components/complaints/animated-status-badge";
import { SlaBadge } from "@/components/sla-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DateCell } from "@/components/ui/date-cell";
import { requireSession } from "@/lib/auth/guard";
import { roleAtLeast } from "@/lib/auth/roles";
import { complaintSummary, listComplaints } from "@/lib/complaints/queries";
import { scopedDb } from "@/lib/db/scoped";
import {
  complaintAgeBusinessDays,
  COMPLAINT_TYPE_LABELS,
  SLA_BUSINESS_DAYS,
} from "@/lib/domain/complaint";
import {
  ageFloorBusinessDays,
  parseComplaintFilters,
} from "@/lib/domain/complaint-filters";
import { ComplaintsTable, type ComplaintTableRow } from "./complaints-table";

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const raw = await searchParams;
  const isFinance = roleAtLeast(ctx.role, "finance_admin");
  const now = new Date();

  const filters = parseComplaintFilters(raw);

  const rows = await listComplaints(
    db,
    {
      // The scope pin. An employee's inbox is their own complaints, decided
      // server-side from the role — never from the query string.
      raisedById: isFinance ? undefined : ctx.userId,
      assignedToId: isFinance && filters.mine ? ctx.userId : undefined,
      status: filters.status,
      type: filters.type,
      ageFloorBusinessDays: ageFloorBusinessDays(filters.age),
    },
    now
  );

  const summary = isFinance ? await complaintSummary(db, {}, now) : null;

  const header = (
    <PageHeader
      title={isFinance ? "Complaints" : "My complaints"}
      description={
        isFinance
          ? `Disputes about reports and payments. Target for a first response is ${SLA_BUSINESS_DAYS} business days.`
          : "Disputes you have raised about your own reports and payments."
      }
    />
  );

  if (!isFinance) {
    return (
      <>
        {header}
        {rows.length === 0 ? (
          <EmptyState
            headline="Nothing in dispute"
            description="If a report or a payment doesn't look right, open it and choose “Raise complaint”."
          />
        ) : (
          <ul className="grid gap-3">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/complaints/${c.id}`}
                  className="border-line bg-bg-surface hover:bg-bg-subtle grid gap-2 rounded-lg border p-4 transition-colors duration-instant ease-out outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label text-text-primary">
                      {COMPLAINT_TYPE_LABELS[c.type]}
                    </span>
                    <AnimatedStatusBadge status={c.status} />
                    <SlaBadge
                      createdAt={c.createdAt}
                      resolvedAt={c.resolvedAt}
                      status={c.status}
                      now={now}
                    />
                  </span>
                  <span className="text-body text-text-secondary line-clamp-2">
                    {c.description}
                  </span>
                  <span className="text-meta text-text-tertiary flex flex-wrap items-center gap-2">
                    {targetLabel(c)}
                    <span aria-hidden="true">·</span>
                    <DateCell value={c.createdAt} format="relative" tone="muted" />
                    {c.messageCount > 0 ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {c.messageCount} {c.messageCount === 1 ? "reply" : "replies"}
                        </span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const tableRows: ComplaintTableRow[] = rows.map((c) => ({
    id: c.id,
    type: c.type,
    status: c.status,
    description: c.description,
    createdAt: c.createdAt.toISOString(),
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    raisedByName: c.raisedBy.name,
    assignedToName: c.assignedTo?.name ?? null,
    targetLabel: targetLabel(c),
    messageCount: c.messageCount,
    // Computed here, from the same business-day function the badge uses, so
    // the row's emphasis and its SLA column can never disagree.
    breached:
      complaintAgeBusinessDays(
        { createdAt: c.createdAt, resolvedAt: c.resolvedAt },
        now
      ) >= SLA_BUSINESS_DAYS,
  }));

  return (
    <>
      {header}

      <div className="grid gap-6">
        {summary ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* No hrefs: these count complaints, and the table below is
                already the list they'd open. A card that links to the screen
                it sits on is a button that does nothing (§7.4). */}
            <StatCard label="Open" value={summary.open} />
            <StatCard label="In review" value={summary.inReview} />
            <StatCard
              label="Past SLA"
              value={summary.breached}
              hint={summary.breached > 0 ? "needs attention today" : undefined}
            />
            <StatCard label="Unassigned" value={summary.unassigned} />
          </div>
        ) : null}

        <ComplaintsTable rows={tableRows} filters={filters} />
      </div>
    </>
  );
}

/** What the complaint is about, in one phrase. */
function targetLabel(c: {
  reportTitle: string | null;
  reimbursementReference: string | null;
}): string {
  if (c.reportTitle) return `Report “${c.reportTitle}”`;
  if (c.reimbursementReference) return `Payment ${c.reimbursementReference}`;
  return "—";
}

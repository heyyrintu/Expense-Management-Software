// Shared complaint queries — ONE module so the inbox, the detail page, the
// employee list and the dashboard widget can never disagree with each other
// (same discipline as lib/analytics). Every call takes a scopedDb.
import type { ScopedDb } from "@/lib/db/scoped";
import {
  OPEN_STATUSES,
  complaintAgeBusinessDays,
  slaBadge,
  type ComplaintStatus,
  type ComplaintType,
  type AssigneeCandidate,
} from "@/lib/domain/complaint";
import type { Role } from "@/lib/auth/roles";

export type ComplaintListFilters = {
  /** Restrict to complaints raised by this user (employee view). */
  raisedById?: string;
  /**
   * Multi-select (D4.3). An empty array means "no filter" — NOT "match
   * nothing" — which is what makes clearing a facet widen the list rather
   * than empty it.
   */
  status?: ComplaintStatus[];
  type?: ComplaintType[];
  /** SLA floor in business days; null for no age filter. */
  ageFloorBusinessDays?: number | null;
  assignedToId?: string;
};

export type ComplaintRow = {
  id: string;
  type: ComplaintType;
  status: ComplaintStatus;
  description: string;
  createdAt: Date;
  resolvedAt: Date | null;
  raisedBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  reportId: string | null;
  reportTitle: string | null;
  reimbursementId: string | null;
  reimbursementReference: string | null;
  messageCount: number;
};

const listSelect = {
  id: true,
  type: true,
  status: true,
  description: true,
  createdAt: true,
  resolvedAt: true,
  reportId: true,
  reimbursementId: true,
  raisedBy: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  report: { select: { id: true, title: true } },
  reimbursement: { select: { id: true, reference: true } },
  _count: { select: { messages: true } },
} as const;

type RawComplaint = {
  id: string;
  type: ComplaintType;
  status: ComplaintStatus;
  description: string;
  createdAt: Date;
  resolvedAt: Date | null;
  reportId: string | null;
  reimbursementId: string | null;
  raisedBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  report: { id: string; title: string } | null;
  reimbursement: { id: string; reference: string } | null;
  _count: { messages: number };
};

function toRow(c: RawComplaint): ComplaintRow {
  return {
    id: c.id,
    type: c.type,
    status: c.status,
    description: c.description,
    createdAt: c.createdAt,
    resolvedAt: c.resolvedAt,
    raisedBy: c.raisedBy,
    assignedTo: c.assignedTo,
    reportId: c.reportId,
    reportTitle: c.report?.title ?? null,
    reimbursementId: c.reimbursementId,
    reimbursementReference: c.reimbursement?.reference ?? null,
    messageCount: c._count.messages,
  };
}

/** Age filtering is business-day maths, so it happens after the fetch. */
export async function listComplaints(
  db: ScopedDb,
  filters: ComplaintListFilters,
  now: Date = new Date()
): Promise<ComplaintRow[]> {
  const where: Record<string, unknown> = {};
  if (filters.raisedById) where.raisedById = filters.raisedById;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  // `in` with one element is the same query plan as equality, so single and
  // multi select need no separate code path.
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }
  if (filters.type && filters.type.length > 0) where.type = { in: filters.type };

  const rows = (await db.complaint.findMany({
    where,
    select: listSelect,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  })) as unknown as RawComplaint[];

  const mapped = rows.map(toRow);
  const floor = filters.ageFloorBusinessDays;
  // Age is business-day maths, not a column, so it filters after the query.
  if (floor === null || floor === undefined) return mapped;
  return mapped.filter(
    (r) =>
      complaintAgeBusinessDays(
        { createdAt: r.createdAt, resolvedAt: r.resolvedAt },
        now
      ) >= floor
  );
}

export type ComplaintSummary = {
  open: number;
  inReview: number;
  breached: number;
  warning: number;
  oldestOpenDays: number;
  unassigned: number;
};

/** Dashboard widget: open complaints + aging. Derived from the same rows. */
export async function complaintSummary(
  db: ScopedDb,
  filters: ComplaintListFilters = {},
  now: Date = new Date()
): Promise<ComplaintSummary> {
  // The summary is about work still to do, so it reads the open statuses
  // explicitly rather than through a magic "open_only" token.
  const rows = await listComplaints(db, { ...filters, status: [...OPEN_STATUSES] }, now);
  let breached = 0;
  let warning = 0;
  let oldest = 0;
  let unassigned = 0;
  for (const r of rows) {
    const badge = slaBadge(
      { createdAt: r.createdAt, resolvedAt: r.resolvedAt, status: r.status },
      now
    );
    if (badge.level === "red") breached++;
    if (badge.level === "amber") warning++;
    if (badge.ageBusinessDays > oldest) oldest = badge.ageBusinessDays;
    if (!r.assignedTo) unassigned++;
  }
  return {
    open: rows.length,
    inReview: rows.filter((r) => r.status === "in_review").length,
    breached,
    warning,
    oldestOpenDays: oldest,
    unassigned,
  };
}

/**
 * Every approver who acted on the report behind this complaint — the people
 * routing must exclude. For a payment complaint we walk through the payment's
 * report, since a payment dispute can still be about that report's approval.
 */
export async function disputedApproverIds(
  db: ScopedDb,
  target: { reportId?: string | null; reimbursementId?: string | null }
): Promise<string[]> {
  let reportId = target.reportId ?? null;
  if (!reportId && target.reimbursementId) {
    const payment = (await db.reimbursement.findUnique({
      where: { id: target.reimbursementId },
      select: { reportId: true },
    })) as { reportId: string } | null;
    reportId = payment?.reportId ?? null;
  }
  if (!reportId) return [];
  const approvals = (await db.approval.findMany({
    where: { reportId },
    select: { approverId: true },
  })) as Array<{ approverId: string }>;
  return [...new Set(approvals.map((a) => a.approverId))];
}

/** Active finance pool (finance_admin + org_admin) available to handle disputes. */
export async function financePool(db: ScopedDb): Promise<AssigneeCandidate[]> {
  const users = (await db.user.findMany({
    where: { role: { in: ["finance_admin", "org_admin"] }, status: "active" },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })) as Array<{ id: string; name: string; role: Role }>;
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

/** Open-complaint load per handler, for deterministic auto-assignment. */
export async function openLoadByAssignee(
  db: ScopedDb
): Promise<Record<string, number>> {
  const rows = (await db.complaint.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, assignedToId: { not: null } },
    select: { assignedToId: true },
  })) as Array<{ assignedToId: string | null }>;
  const load: Record<string, number> = {};
  for (const r of rows) {
    if (r.assignedToId) load[r.assignedToId] = (load[r.assignedToId] ?? 0) + 1;
  }
  return load;
}

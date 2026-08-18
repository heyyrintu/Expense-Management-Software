// Complaint (expense-linked dispute) domain — pure. PLAN 7.3.
//
// Rules that live here, not in actions or components:
//   * a complaint disputes exactly ONE thing: a report OR a payment
//   * status machine open -> in_review -> resolved | wont_fix (terminal)
//   * closing a complaint always needs a resolution note
//   * SLA is 5 BUSINESS days from creation (green / amber / red)
//   * routing never lands a complaint on the approver whose decision
//     is being disputed, nor on the person who raised it
import { roleAtLeast, type Role } from "@/lib/auth/roles";

export const COMPLAINT_TYPES = [
  "wrong_amount",
  "unfair_rejection",
  "payment_not_received",
  "other",
] as const;
export type ComplaintType = (typeof COMPLAINT_TYPES)[number];

export const COMPLAINT_STATUSES = [
  "open",
  "in_review",
  "resolved",
  "wont_fix",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_ACTIONS = ["start_review", "resolve", "wont_fix"] as const;
export type ComplaintAction = (typeof COMPLAINT_ACTIONS)[number];

/** Terminal statuses — the record is immutable afterwards (thread excepted). */
export const CLOSED_STATUSES: readonly ComplaintStatus[] = ["resolved", "wont_fix"];
export const OPEN_STATUSES: readonly ComplaintStatus[] = ["open", "in_review"];

export function isClosed(status: ComplaintStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  wrong_amount: "Wrong amount",
  unfair_rejection: "Unfair rejection",
  payment_not_received: "Payment not received",
  other: "Other",
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: "Open",
  in_review: "In review",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

// ---------------------------------------------------------------------------
// Target: exactly one of report / reimbursement
// ---------------------------------------------------------------------------

export type ComplaintTarget =
  | { kind: "report"; reportId: string }
  | { kind: "reimbursement"; reimbursementId: string };

/**
 * Mirrors the `complaints_exactly_one_target` CHECK constraint so the API can
 * reject bad input with a readable message instead of a database error.
 */
export function complaintTargetOf(input: {
  reportId?: string | null;
  reimbursementId?: string | null;
}): { ok: true; target: ComplaintTarget } | { ok: false; error: string } {
  const hasReport = Boolean(input.reportId);
  const hasPayment = Boolean(input.reimbursementId);
  if (hasReport === hasPayment) {
    return {
      ok: false,
      error: "A complaint must be about exactly one report or one payment.",
    };
  }
  return hasReport
    ? { ok: true, target: { kind: "report", reportId: input.reportId as string } }
    : {
        ok: true,
        target: {
          kind: "reimbursement",
          reimbursementId: input.reimbursementId as string,
        },
      };
}

/** payment_not_received disputes point at a payment; unfair_rejection at a report. */
export function typeMatchesTarget(
  type: ComplaintType,
  target: ComplaintTarget
): boolean {
  if (type === "payment_not_received") return target.kind === "reimbursement";
  if (type === "unfair_rejection") return target.kind === "report";
  return true;
}

// ---------------------------------------------------------------------------
// Status machine
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<
  ComplaintAction,
  { from: ComplaintStatus[]; to: ComplaintStatus }
> = {
  start_review: { from: ["open"], to: "in_review" },
  resolve: { from: ["open", "in_review"], to: "resolved" },
  wont_fix: { from: ["open", "in_review"], to: "wont_fix" },
};

/** Closing a complaint (either way) requires a written resolution note. */
export function requiresResolutionNote(action: ComplaintAction): boolean {
  return action === "resolve" || action === "wont_fix";
}

export function nextComplaintStatus(
  current: ComplaintStatus,
  action: ComplaintAction
): { ok: true; status: ComplaintStatus } | { ok: false; error: string } {
  const rule = TRANSITIONS[action];
  if (!rule) return { ok: false, error: "Unknown complaint action." };
  if (!rule.from.includes(current)) {
    return isClosed(current)
      ? { ok: false, error: "This complaint is closed and can no longer change." }
      : {
          ok: false,
          error: `Cannot ${action.replace("_", " ")} a complaint that is ${current}.`,
        };
  }
  return { ok: true, status: rule.to };
}

export function availableActions(current: ComplaintStatus): ComplaintAction[] {
  return COMPLAINT_ACTIONS.filter((a) => TRANSITIONS[a].from.includes(current));
}

// ---------------------------------------------------------------------------
// SLA — 5 business days
// ---------------------------------------------------------------------------

export const SLA_BUSINESS_DAYS = 5;
/** Amber once this many business days have elapsed; red at SLA_BUSINESS_DAYS. */
export const SLA_WARN_BUSINESS_DAYS = 3;

export type SlaLevel = "green" | "amber" | "red";

const DAY_MS = 86_400_000;

function utcDayIndex(d: Date): number {
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS
  );
}

function isWeekend(dayIndex: number): boolean {
  const dow = new Date(dayIndex * DAY_MS).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Business days elapsed between two instants — counts each Mon–Fri day AFTER
 * `from` up to and including `to`. Same day is 0, and a complaint raised on
 * Friday is still 0 days old on Sunday. Public holidays are out of scope.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  const start = utcDayIndex(from);
  const end = utcDayIndex(to);
  if (end <= start) return 0;

  // Any 7 consecutive days contain exactly 5 weekdays, so whole weeks are
  // closed-form and only the remainder (< 7 days) needs walking.
  const span = end - start;
  const fullWeeks = Math.floor(span / 7);
  let count = fullWeeks * 5;
  for (let day = start + fullWeeks * 7 + 1; day <= end; day++) {
    if (!isWeekend(day)) count++;
  }
  return count;
}

/**
 * Age of a complaint in business days: to now while open, frozen at the
 * resolution date once closed.
 */
export function complaintAgeBusinessDays(
  complaint: { createdAt: Date; resolvedAt?: Date | null },
  now: Date
): number {
  return businessDaysBetween(complaint.createdAt, complaint.resolvedAt ?? now);
}

export function slaLevel(ageBusinessDays: number): SlaLevel {
  if (ageBusinessDays >= SLA_BUSINESS_DAYS) return "red";
  if (ageBusinessDays >= SLA_WARN_BUSINESS_DAYS) return "amber";
  return "green";
}

export type SlaBadge = {
  level: SlaLevel;
  ageBusinessDays: number;
  breached: boolean;
  label: string;
};

export function slaBadge(
  complaint: {
    createdAt: Date;
    resolvedAt?: Date | null;
    status: ComplaintStatus;
  },
  now: Date
): SlaBadge {
  const age = complaintAgeBusinessDays(complaint, now);
  const level = slaLevel(age);
  const closed = isClosed(complaint.status);
  const unit = age === 1 ? "day" : "days";
  return {
    level,
    ageBusinessDays: age,
    breached: age >= SLA_BUSINESS_DAYS,
    label: closed
      ? `Closed in ${age} business ${unit}`
      : age >= SLA_BUSINESS_DAYS
        ? `${age} business ${unit} — SLA breached`
        : `${age} of ${SLA_BUSINESS_DAYS} business days`,
  };
}

// ---------------------------------------------------------------------------
// Routing / permissions
// ---------------------------------------------------------------------------

export type AssigneeCandidate = {
  id: string;
  name: string;
  role: Role;
};

export type RoutingContext = {
  /** Who raised the complaint — they can never handle their own dispute. */
  raisedById: string;
  /**
   * Approvers whose decision is under dispute (every approver who acted on
   * the report behind this complaint). Never auto- or manually assigned.
   */
  disputedApproverIds: readonly string[];
};

/**
 * The one routing rule that cannot break: a complaint goes to the finance
 * pool, and NEVER to the approver whose decision is being disputed (or to the
 * complainant themselves) — even if that approver also holds a finance role.
 */
export function canAssignComplaint(
  candidate: AssigneeCandidate,
  ctx: RoutingContext
): boolean {
  if (!roleAtLeast(candidate.role, "finance_admin")) return false;
  if (candidate.id === ctx.raisedById) return false;
  if (ctx.disputedApproverIds.includes(candidate.id)) return false;
  return true;
}

/** Assignable finance pool, ordered as given. */
export function eligibleAssignees(
  pool: readonly AssigneeCandidate[],
  ctx: RoutingContext
): AssigneeCandidate[] {
  return pool.filter((c) => canAssignComplaint(c, ctx));
}

/**
 * Auto-routing on creation: pick the least-loaded eligible handler, ties
 * broken by id so the choice is deterministic. Returns null when no one in
 * the pool is eligible — the complaint then sits unassigned in the inbox.
 */
export function autoAssign(
  pool: readonly AssigneeCandidate[],
  ctx: RoutingContext,
  openLoad: Readonly<Record<string, number>> = {}
): AssigneeCandidate | null {
  const eligible = eligibleAssignees(pool, ctx);
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => {
    const la = openLoad[a.id] ?? 0;
    const lb = openLoad[b.id] ?? 0;
    return la - lb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  })[0];
}

/** Raiser sees their own; finance_admin+ sees all complaints in the org. */
export function canViewComplaint(input: {
  actorId: string;
  actorRole: Role;
  raisedById: string;
}): boolean {
  if (input.actorId === input.raisedById) return true;
  return roleAtLeast(input.actorRole, "finance_admin");
}

/** Only finance_admin+ drives the status machine. */
export function canManageComplaint(actorRole: Role): boolean {
  return roleAtLeast(actorRole, "finance_admin");
}

/**
 * The thread stays open after resolution (the record itself is frozen) —
 * anyone who can view the complaint can post to it.
 */
export function canPostMessage(input: {
  actorId: string;
  actorRole: Role;
  raisedById: string;
}): boolean {
  return canViewComplaint(input);
}

// The status → token map (DESIGN-PRD §5.2).
//
// THIS IS THE ONLY PLACE STATUS COLOUR IS DEFINED. StatusBadge reads it;
// nothing else may hand-colour a status, invent a shade, or map a state to a
// palette class. Adding a state means adding a row here.
//
// Pure data + pure lookup, so it is unit-testable and safe to import from
// server components.

/** The five semantic tones. Every state resolves to exactly one. */
export const STATUS_TONES = ["success", "warning", "danger", "info", "neutral"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

export type StatusEntry = {
  /** Label shown in the badge — status is never colour alone (§5.1). */
  label: string;
  tone: StatusTone;
  /** A solid dot marks a terminal money state (§5.2: Reimbursed). */
  solidDot?: boolean;
};

/**
 * Keys are the domain values as they appear in the database (report status,
 * advance status, reconciliation buckets, complaint status), so a caller can
 * pass a raw status through without translating it first.
 */
export const STATUS_MAP: Record<string, StatusEntry> = {
  // ---- Report workflow (lib/domain/report-workflow.ts) ----
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  in_review: { label: "In review", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  sent_back: { label: "Sent back", tone: "warning" },
  partially_reimbursed: { label: "Partly paid", tone: "warning" },
  reimbursed: { label: "Paid", tone: "success", solidDot: true },

  // ---- Advances (lib/domain/advance.ts) ----
  disbursed: { label: "Disbursed", tone: "info" },
  partially_settled: { label: "Partly settled", tone: "warning" },
  settled: { label: "Settled", tone: "success", solidDot: true },

  // ---- Policy ----
  flagged: { label: "Flagged", tone: "warning" },

  // ---- Bank reconciliation (7.2) ----
  matched: { label: "Matched", tone: "success" },
  missing_in_bank: { label: "Not in bank", tone: "danger" },
  missing_in_app: { label: "Not in app", tone: "warning" },

  // ---- Complaints (7.3) ----
  open: { label: "Open", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  wont_fix: { label: "Won't fix", tone: "neutral" },

  // ---- Users / orgs ----
  active: { label: "Active", tone: "success" },
  invited: { label: "Invited", tone: "info" },
  deactivated: { label: "Deactivated", tone: "neutral" },
  suspended: { label: "Suspended", tone: "danger" },
};

/** Unknown states fall back to neutral with the raw value humanised. */
export function statusEntry(status: string): StatusEntry {
  const known = STATUS_MAP[status];
  if (known) return known;
  return {
    label: status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    tone: "neutral",
  };
}

/**
 * Token classes per tone. Text uses the accessible `-text` shade (D0.1).
 *
 * `text` (D1.1) is the bare foreground, for the rare case where a semantic
 * colour belongs on plain text rather than in a chip — a negative amount in
 * the ledger being the only one so far (DESIGN-PRD §6.2). It is exported
 * here rather than written at the call site for the same reason `chip` is:
 * so status colour has exactly one definition.
 */
export const TONE_CLASSES: Record<StatusTone, { chip: string; dot: string; text: string }> = {
  success: {
    chip: "bg-status-success-subtle text-status-success-text",
    dot: "bg-status-success",
    text: "text-status-success-text",
  },
  warning: {
    chip: "bg-status-warning-subtle text-status-warning-text",
    dot: "bg-status-warning",
    text: "text-status-warning-text",
  },
  danger: {
    chip: "bg-status-danger-subtle text-status-danger-text",
    dot: "bg-status-danger",
    text: "text-status-danger-text",
  },
  info: {
    chip: "bg-status-info-subtle text-status-info-text",
    dot: "bg-status-info",
    text: "text-status-info-text",
  },
  neutral: {
    chip: "bg-status-neutral-subtle text-status-neutral-text",
    dot: "bg-status-neutral",
    text: "text-status-neutral-text",
  },
};

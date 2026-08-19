// WhatsApp template registry (8.3) — pure.
//
// Meta only allows free-form messages inside a 24-hour customer-service
// window that opens when the user last messaged us. Outside it, a business
// may only send a pre-approved TEMPLATE. This module owns that decision and
// the event → template mapping, so nothing else has to reason about it.
import type { TemplateParams } from "./types";

export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_LANGUAGE = process.env.WA_TEMPLATE_LANG ?? "en";

/** Events that can reach a person over WhatsApp. */
export const WHATSAPP_EVENTS = [
  "report.submitted",
  "report.approved",
  "report.rejected",
  "report.sent_back",
  "payment.done",
  "complaint.status_changed",
] as const;
export type WhatsAppEvent = (typeof WHATSAPP_EVENTS)[number];

export type EventPayload = {
  recipientName: string;
  reportTitle?: string;
  actorName?: string;
  amountFormatted?: string;
  reference?: string;
  reason?: string;
  status?: string;
  reportId?: string;
  complaintId?: string;
};

/**
 * Template names as registered in the Meta Business Manager. Keep these in
 * sync with the approved templates — an unknown name is rejected by the API,
 * which is why sends are logged and retried rather than silently dropped.
 */
export const TEMPLATE_NAMES: Record<WhatsAppEvent, string> = {
  "report.submitted": "report_submitted",
  "report.approved": "report_approved",
  "report.rejected": "report_rejected",
  "report.sent_back": "report_sent_back",
  "payment.done": "payment_done",
  "complaint.status_changed": "complaint_status",
};

function dash(value: string | undefined, fallback = "—"): string {
  const v = (value ?? "").trim();
  // Meta rejects parameters with newlines or runs of spaces.
  return (v.length > 0 ? v : fallback).replace(/\s+/g, " ").slice(0, 250);
}

/** Ordered body parameters for each template — position matters. */
export function templateFor(
  event: WhatsAppEvent,
  p: EventPayload
): TemplateParams {
  const name = TEMPLATE_NAMES[event];
  const language = DEFAULT_LANGUAGE;
  switch (event) {
    case "report.submitted":
      // {{1}} approver, {{2}} submitter, {{3}} report, {{4}} amount
      return {
        name,
        languageCode: language,
        bodyParams: [
          dash(p.recipientName),
          dash(p.actorName, "A teammate"),
          dash(p.reportTitle),
          dash(p.amountFormatted),
        ],
      };
    case "report.approved":
      // {{1}} employee, {{2}} report, {{3}} amount
      return {
        name,
        languageCode: language,
        bodyParams: [dash(p.recipientName), dash(p.reportTitle), dash(p.amountFormatted)],
      };
    case "report.rejected":
    case "report.sent_back":
      // {{1}} employee, {{2}} report, {{3}} decider, {{4}} reason
      return {
        name,
        languageCode: language,
        bodyParams: [
          dash(p.recipientName),
          dash(p.reportTitle),
          dash(p.actorName),
          dash(p.reason, "No reason given"),
        ],
      };
    case "payment.done":
      // {{1}} employee, {{2}} amount, {{3}} report, {{4}} UTR/reference
      return {
        name,
        languageCode: language,
        bodyParams: [
          dash(p.recipientName),
          dash(p.amountFormatted),
          dash(p.reportTitle),
          dash(p.reference),
        ],
      };
    case "complaint.status_changed":
      // {{1}} employee, {{2}} new status, {{3}} note
      return {
        name,
        languageCode: language,
        bodyParams: [
          dash(p.recipientName),
          dash(p.status),
          dash(p.reason, "No note"),
        ],
      };
  }
}

/** The same content as plain text, for use inside the 24-hour window. */
export function freeFormFor(event: WhatsAppEvent, p: EventPayload): string {
  switch (event) {
    case "report.submitted":
      return `${p.actorName ?? "A teammate"} submitted “${p.reportTitle}”${
        p.amountFormatted ? ` (${p.amountFormatted})` : ""
      } for your approval.`;
    case "report.approved":
      return `Your report “${p.reportTitle}”${
        p.amountFormatted ? ` (${p.amountFormatted})` : ""
      } was approved. It now moves to reimbursement.`;
    case "report.rejected":
      return `Your report “${p.reportTitle}” was rejected${
        p.actorName ? ` by ${p.actorName}` : ""
      }${p.reason ? `: ${p.reason}` : "."} The expenses are back in your drafts.`;
    case "report.sent_back":
      return `Your report “${p.reportTitle}” was sent back${
        p.actorName ? ` by ${p.actorName}` : ""
      }${p.reason ? `: ${p.reason}` : "."} Fix it up and resubmit.`;
    case "payment.done":
      return `${p.amountFormatted} for “${p.reportTitle}” has been paid${
        p.reference ? `. Reference ${p.reference}` : "."
      }`;
    case "complaint.status_changed":
      return `Your complaint is now ${p.status ?? "updated"}${
        p.reason ? `: ${p.reason}` : "."
      }`;
  }
}

// ---------------------------------------------------------------------------
// 24-hour session window
// ---------------------------------------------------------------------------

export type SendMode =
  | { kind: "free_form"; body: string }
  | { kind: "template"; template: TemplateParams };

/**
 * Inside the window (the user messaged us in the last 24h) we may send plain
 * text — which is also the only way to attach quick-reply buttons without a
 * pre-approved button template. Outside it, only a template.
 */
export function withinSessionWindow(
  lastInboundAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastInboundAt) return false;
  const elapsed = now.getTime() - lastInboundAt.getTime();
  return elapsed >= 0 && elapsed < SESSION_WINDOW_MS;
}

export function sendModeFor(
  event: WhatsAppEvent,
  payload: EventPayload,
  lastInboundAt: Date | null | undefined,
  now: Date = new Date()
): SendMode {
  return withinSessionWindow(lastInboundAt, now)
    ? { kind: "free_form", body: freeFormFor(event, payload) }
    : { kind: "template", template: templateFor(event, payload) };
}

// ---------------------------------------------------------------------------
// Quick approve (buttons on report.submitted)
// ---------------------------------------------------------------------------

export const QUICK_ACTIONS = ["approve", "open"] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number];

export function encodeApprovalPayload(action: QuickAction, reportId: string): string {
  return `ap:${action}:${reportId}`;
}

export function decodeApprovalPayload(
  payload: string | null | undefined
): { action: QuickAction; reportId: string } | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "ap") return null;
  const [, action, reportId] = parts;
  if (!(QUICK_ACTIONS as readonly string[]).includes(action)) return null;
  if (!reportId) return null;
  return { action: action as QuickAction, reportId };
}

/**
 * Buttons for a submitted-report notification.
 *
 * A policy-flagged report can NEVER be approved from chat — the approver has
 * to see the flags and record a justification, so the Approve button is
 * replaced by "Open in app". Reject is never offered here at all: it always
 * needs a written reason.
 */
export function approvalButtons(input: {
  reportId: string;
  flagged: boolean;
}): Array<{ id: string; title: string }> {
  const open = {
    id: encodeApprovalPayload("open", input.reportId),
    title: "🔗 Open in app",
  };
  if (input.flagged) return [open];
  return [
    { id: encodeApprovalPayload("approve", input.reportId), title: "✅ Approve" },
    open,
  ];
}

export const FLAGGED_NOTE =
  "This one has policy flags, so it needs a look in the app before approval.";

export const QUICK_APPROVE_REPLIES = {
  approved: (title: string) => `Approved “${title}”. Thanks!`,
  notEligible: "That report isn't waiting on your decision any more.",
  flagged:
    "That report has policy flags — open it in the app to review and approve with a justification.",
  notAllowed: "You're not able to approve that report.",
  gone: "I can't find that report any more.",
} as const;

export function openInAppReply(url: string): string {
  return `Open it here: ${url}`;
}

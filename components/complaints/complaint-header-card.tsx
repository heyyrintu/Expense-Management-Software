// Complaint header card (D4.3) — DESIGN-PRD §7.7's "original complaint card".
//
// The thing being disputed, stated once at the top: what kind of problem,
// what it's about, where it stands, and how long it has been waiting. Every
// message below is a reply to this card, so it carries no actions of its own
// — the handler's controls live in their own panel, and mixing "here is the
// dispute" with "here is what you can do about it" makes both harder to read.
import Link from "next/link";

import { AnimatedStatusBadge } from "@/components/complaints/animated-status-badge";
import { SlaBadge } from "@/components/sla-badge";
import { Amount } from "@/components/ui/amount";
import { DateCell } from "@/components/ui/date-cell";
import {
  COMPLAINT_TYPE_LABELS,
  type ComplaintStatus,
  type ComplaintType,
} from "@/lib/domain/complaint";

export type ComplaintHeaderProps = {
  type: ComplaintType;
  status: ComplaintStatus;
  description: string;
  /** ISO instants — DateCell parses them (D1.1). */
  createdAt: string;
  resolvedAt: string | null;
  raisedByName: string;
  assignedToName: string | null;
  /** The disputed report or payment. */
  target:
    | { kind: "report"; href: string; title: string }
    | {
        kind: "payment";
        href: string;
        reference: string;
        amount: number;
        currency: string;
        paidAt: string;
        method: string;
      }
    | null;
  attachmentUrl: string | null;
  /** Auto-attached for payment_not_received — no copy is made. */
  proofUrl: string | null;
};

export function ComplaintHeaderCard({
  type,
  status,
  description,
  createdAt,
  resolvedAt,
  raisedByName,
  assignedToName,
  target,
  attachmentUrl,
  proofUrl,
}: ComplaintHeaderProps) {
  return (
    <section className="border-line bg-bg-surface grid gap-4 rounded-lg border p-5">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-h2 text-text-primary">{COMPLAINT_TYPE_LABELS[type]}</h1>
          <AnimatedStatusBadge status={status} />
          {/* Dates come in as strings for D1.1's sake; SlaBadge does business-
              day maths, so it needs the real instants back. */}
          <SlaBadge
            createdAt={new Date(createdAt)}
            resolvedAt={resolvedAt ? new Date(resolvedAt) : null}
            status={status}
          />
        </div>
        <p className="text-meta text-text-tertiary">
          Raised by {raisedByName} · <DateCell value={createdAt} format="relative" tone="muted" />
          {" · "}
          {assignedToName ? `handled by ${assignedToName}` : "not yet assigned"}
        </p>
      </div>

      <p className="text-body text-text-primary whitespace-pre-wrap">{description}</p>

      {target || attachmentUrl || proofUrl ? (
        <div className="border-line grid gap-2 border-t pt-4">
          {target ? (
            <Link
              href={target.href}
              className="text-body text-accent-text w-fit underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
            >
              {target.kind === "report"
                ? `Report “${target.title}”`
                : `Payment ${target.reference}`}
            </Link>
          ) : null}

          {target?.kind === "payment" ? (
            <span className="text-meta text-text-tertiary flex flex-wrap items-center gap-1">
              <Amount
                value={target.amount}
                currency={target.currency}
                size="meta"
                tone="muted"
              />
              <span>via {target.method.replace("_", " ")} on</span>
              {/* Absolute: this is the date being disputed against a bank
                  statement, never "3 days ago" (CLAUDE.md). */}
              <DateCell value={target.paidAt} tone="muted" />
            </span>
          ) : null}

          <span className="flex flex-wrap gap-3">
            {attachmentUrl ? (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-meta text-accent-text underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
              >
                Attachment
              </a>
            ) : null}
            {proofUrl ? (
              <a
                href={proofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-meta text-accent-text underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
              >
                Payment proof (attached automatically)
              </a>
            ) : null}
          </span>
        </div>
      ) : null}
    </section>
  );
}

/** The outcome, once there is one. Success tone for resolved, neutral for
 *  won't-fix — declining to act is not a failure, and colouring it red would
 *  read as an error the reader should chase. */
export function ResolutionCard({
  status,
  note,
  resolvedAt,
}: {
  status: ComplaintStatus;
  note: string;
  resolvedAt: string | null;
}) {
  const resolved = status === "resolved";
  return (
    <section
      className={
        resolved
          ? "border-status-success-subtle bg-status-success-subtle grid gap-1 rounded-lg border p-4"
          : "border-line bg-bg-subtle grid gap-1 rounded-lg border p-4"
      }
    >
      <span
        className={
          resolved
            ? "text-label text-status-success-text"
            : "text-label text-text-secondary"
        }
      >
        {resolved ? "Resolved" : "Closed as won’t fix"}
        {resolvedAt ? " · " : null}
        {resolvedAt ? <DateCell value={resolvedAt} tone="muted" /> : null}
      </span>
      <p className="text-body text-text-primary whitespace-pre-wrap">{note}</p>
    </section>
  );
}

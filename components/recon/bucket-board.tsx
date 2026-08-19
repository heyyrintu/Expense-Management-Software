// Reconciliation buckets (D4.2) — DESIGN-PRD §7.6, "three labeled buckets
// with counts".
//
// ── WHY THE TONES ARE WHAT THEY ARE ───────────────────────────────────────
// Matched is success: nothing to do.
//
// "Not in bank" is DANGER. The app says a payment was made and the bank has
// no record of it — either the money never moved and an employee is waiting,
// or the app's record is wrong. Both are worse than the other bucket.
//
// "Not in app" is WARNING. A debit the app can't explain is usually a
// legitimate payment someone forgot to record, and the screen offers a
// one-click way to record it. It needs attention, not alarm.
//
// Getting these two the same colour, or the wrong way round, would flatten
// the single distinction the board exists to draw.
// ──────────────────────────────────────────────────────────────────────────
import { cn } from "@/lib/utils";

export type BucketTone = "success" | "danger" | "warning";

const TONE: Record<
  BucketTone,
  { edge: string; chip: string; heading: string }
> = {
  success: {
    edge: "border-t-status-success",
    chip: "bg-status-success-subtle text-status-success-text",
    heading: "text-text-primary",
  },
  danger: {
    edge: "border-t-status-danger",
    chip: "bg-status-danger-subtle text-status-danger-text",
    heading: "text-status-danger-text",
  },
  warning: {
    edge: "border-t-status-warning",
    chip: "bg-status-warning-subtle text-status-warning-text",
    heading: "text-status-warning-text",
  },
};

export function BucketBoard({ children }: { children: React.ReactNode }) {
  // Three equal columns on desktop, stacked below lg. Equal on purpose: the
  // buckets are a partition of one set, and sizing them by importance would
  // imply the empty one matters less than the full one — when an empty
  // "Not in bank" is the best possible outcome.
  return <div className="grid gap-4 lg:grid-cols-3">{children}</div>;
}

export function Bucket({
  title,
  description,
  count,
  tone,
  children,
}: {
  title: string;
  description: string;
  count: number;
  tone: BucketTone;
  children: React.ReactNode;
}) {
  const t = TONE[tone];

  return (
    <section
      className={cn(
        "border-line bg-bg-surface grid content-start gap-3 rounded-lg border p-4",
        // A 2px top edge in the bucket's tone. An edge rather than a filled
        // header: the rows inside carry their own colour, and two tinted
        // surfaces stacked read as one loud panel.
        "border-t-2",
        t.edge
      )}
    >
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2">
          <span className={cn("text-h3", t.heading)}>{title}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-meta tabular", t.chip)}>
            {count}
          </span>
        </h2>
        <p className="text-meta text-text-tertiary">{description}</p>
      </div>

      {/* Bounded and scrollable: a 200-line statement must not push the other
          two buckets off the screen, and the point of a board is seeing all
          three at once. */}
      <ul className="max-h-bucket divide-line grid divide-y overflow-y-auto">
        {children}
      </ul>
    </section>
  );
}

/** The "nothing here" line inside a bucket. Empty is not always good news —
 *  an empty Matched bucket means nothing reconciled — so the caller supplies
 *  the sentence rather than getting a generic one. */
export function BucketEmpty({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-meta text-text-tertiary py-6 text-center">{children}</li>
  );
}

import * as React from "react";

import { formatDate, formatRelative, toIsoString } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * DateCell (D1.1) — THE way a date is rendered.
 *
 * One project-wide format: dd MMM yyyy. Not because it is prettiest, but
 * because "12 Aug 2026" cannot be misread. 12/08/2026 is the 12th of August
 * to half the world and the 8th of December to the other half, and this
 * product reconciles bank statements — a date the reader has to guess at is
 * worse than no date.
 *
 * Always renders a <time> element carrying the full ISO instant, so the
 * machine-readable value is there for anyone (or anything) that needs it,
 * regardless of which variant is displayed.
 */

export type DateFormat = "date" | "relative";

export type DateCellProps = {
  value: Date | string | null | undefined;
  /**
   * `relative` ("2 days ago") is for ACTIVITY AND META CONTEXTS ONLY —
   * comment timestamps, audit rows, notification lists. Never for an expense
   * date, a report period, or anything in a column someone compares against
   * a bank statement. See the note in lib/format.ts.
   */
  format?: DateFormat;
  /** Injectable clock, so relative output is testable and stable in stories. */
  now?: Date;
  tone?: "default" | "muted";
  emptyLabel?: string;
  className?: string;
};

function DateCell({
  value,
  format = "date",
  now,
  tone = "default",
  emptyLabel = "—",
  className,
}: DateCellProps) {
  if (value === null || value === undefined) {
    return (
      <span className={cn("text-meta text-text-tertiary", className)}>
        <span aria-hidden="true">{emptyLabel}</span>
        <span className="sr-only">No date</span>
      </span>
    );
  }

  const date = typeof value === "string" ? new Date(value) : value;

  // A malformed date string must not render "Invalid Date" into a finance
  // screen. Fail visibly but calmly, the same way a missing value does.
  if (Number.isNaN(date.getTime())) {
    return (
      <span className={cn("text-meta text-text-tertiary", className)}>
        <span aria-hidden="true">{emptyLabel}</span>
        <span className="sr-only">Date unavailable</span>
      </span>
    );
  }

  const absolute = formatDate(date);
  const relative = format === "relative";

  return (
    <time
      data-slot="date-cell"
      dateTime={toIsoString(date)}
      // The absolute date stays reachable on hover when the label is relative:
      // "2 days ago" is a summary, and sometimes you need the actual day.
      title={relative ? absolute : undefined}
      className={cn(
        "tabular",
        relative ? "text-meta" : "text-body",
        tone === "muted" || relative ? "text-text-tertiary" : "text-text-secondary",
        className
      )}
    >
      {relative ? formatRelative(date, now) : absolute}
    </time>
  );
}

export { DateCell };

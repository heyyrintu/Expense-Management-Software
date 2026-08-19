import * as React from "react";

import { Amount } from "@/components/ui/amount";
import { cn } from "@/lib/utils";

/**
 * Paid vs. balance (D3.2) — DESIGN-PRD §7.4's "outstanding to employees",
 * shown wherever a report is partly paid.
 *
 * A thin accent bar for what has been paid, and the BALANCE IN THE WARNING
 * TOKEN. That colour choice is the whole component: money still owed to an
 * employee is not neutral information. It is the number that decides whether
 * this row needs another payment run, and finance should be able to find it
 * without reading.
 *
 * The bar is 4px and unlabelled: it shows proportion, and the two figures
 * underneath carry the values. A progress bar with numbers written on it is
 * a chart pretending to be a control.
 */
export function PaymentProgress({
  /** Integer minor units. */
  total,
  paid,
  currency,
  className,
}: {
  total: number;
  paid: number;
  currency: string;
  className?: string;
}) {
  const balance = Math.max(0, total - paid);
  // Guard the divide: a zero-total report shouldn't render NaN% of a bar.
  const fraction = total > 0 ? Math.min(1, Math.max(0, paid / total)) : 0;
  const settled = balance === 0 && paid > 0;

  return (
    <div className={cn("grid gap-1", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={paid}
        aria-label={`Paid ${paid} of ${total}`}
        className="bg-bg-subtle h-1 w-full overflow-hidden rounded-full"
      >
        {/* scaleX, not width — a transform, so it never triggers layout. */}
        <div
          className={cn(
            "h-full w-full origin-left rounded-full",
            "transition-transform duration-base ease-out",
            settled ? "bg-status-success" : "bg-accent"
          )}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-meta text-text-tertiary">
          Paid <Amount value={paid} currency={currency} size="meta" tone="muted" /> of{" "}
          <Amount value={total} currency={currency} size="meta" tone="muted" />
        </span>
        {balance > 0 ? (
          <span className="text-meta text-status-warning-text flex items-baseline gap-1">
            Balance
            {/* <Amount> sets its own colour, so the warning tone is passed
                through className — tailwind-merge lets the later class win.
                An outstanding balance is not neutral information. */}
            <Amount
              value={balance}
              currency={currency}
              size="meta"
              className="text-status-warning-text"
            />
          </span>
        ) : (
          <span className="text-meta text-status-success-text">Settled</span>
        )}
      </div>
    </div>
  );
}

"use client";

// RankList (D3.3) — the "category breakdown + top spenders" half of §7.4.
//
// A ranked list rather than a second chart, for two reasons. A bar chart of
// eight categories answers "which is biggest" and refuses "how much was
// travel" — the number a finance reader actually came for. And a list can
// carry a link per row, so every line is a way into the expenses behind it,
// which a chart segment is not.
//
// The proportion bar is scaled to the LARGEST row, not to the total. Share-of-
// total would render the long tail as invisible slivers and turn the bottom
// half of the list into decoration; scaled to the leader, every row has a
// length you can compare against its neighbour.
import Link from "next/link";

import { Amount } from "@/components/ui/amount";
import { cn } from "@/lib/utils";

export type RankRow = {
  key: string;
  label: string;
  /** Integer minor units. */
  total: number;
  count?: number;
  /** The filtered list behind this row. Omit for a non-clickable row. */
  href?: string;
};

export function RankList({
  rows,
  currency,
  limit = 8,
  emptyMessage = "Nothing to show in this view.",
  className,
}: {
  rows: RankRow[];
  currency: string;
  limit?: number;
  emptyMessage?: string;
  className?: string;
}) {
  const top = rows.slice(0, limit);
  const max = top.reduce((m, r) => Math.max(m, r.total), 0);

  if (top.length === 0) {
    return <p className="text-body text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <ul className={cn("grid gap-1", className)}>
      {top.map((row) => {
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-body text-text-primary truncate">
                {row.label}
                {row.count !== undefined ? (
                  <span className="text-meta text-text-tertiary tabular"> · {row.count}</span>
                ) : null}
              </span>
              <Amount value={row.total} currency={currency} align="right" />
            </span>
            {/* Decorative: the number beside it is the accessible value, so
                a screen reader hearing this twice would learn nothing. */}
            <span
              aria-hidden="true"
              className="bg-bg-subtle block h-1 w-full overflow-hidden rounded-full"
            >
              {/* scaleX, not width — same rule PaymentProgress follows: a
                  transform never triggers layout, so a list of these costs
                  one composite instead of eight reflows. */}
              <span
                className="bg-accent block h-full w-full origin-left rounded-full"
                style={{ transform: `scaleX(${max === 0 ? 0 : row.total / max})` }}
              />
            </span>
          </>
        );

        const shell =
          "grid gap-2 rounded-md px-2 py-2 -mx-2 outline-none";
        const interactive =
          "hover:bg-bg-subtle transition-colors duration-instant ease-out focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2";

        return (
          <li key={row.key}>
            {row.href ? (
              <Link href={row.href} className={cn(shell, interactive)}>
                {body}
              </Link>
            ) : (
              <div className={shell}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

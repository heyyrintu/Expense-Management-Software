"use client";

// Sticky action bar (D2.1) — DESIGN-PRD §7.1.
//
// "Sticky bottom bar: Save draft (ghost) + Add to report (primary). Nothing
// else on screen competes."
//
// Sticky rather than fixed: it sits at the end of the form and pins to the
// bottom of the viewport while there is more form below it. A `fixed` bar
// floats over content forever, including over the last field, which on a
// phone is exactly where the purpose box lives.
//
// It clears the mobile tab bar, because a submit button hidden behind
// navigation is a form nobody can finish.
import * as React from "react";

import { cn } from "@/lib/utils";

export function StickyActionBar({
  children,
  /** Status line — the Saved indicator, an error, a hint. */
  status,
  className,
}: {
  children: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-2 md:-mx-6",
        // Sits above the tab bar on mobile; on desktop there is nothing below.
        "pb-tabbar md:pb-0",
        className
      )}
    >
      <div
        className={cn(
          "border-line bg-bg-surface flex flex-wrap items-center gap-3 border-t px-4 py-3 md:px-6",
          // Border, never a shadow (§5.4) — a shadow here would make the bar
          // hover above a form it is part of.
          "shadow-flat"
        )}
      >
        {status ? <span className="flex min-w-0 flex-1 items-center gap-2">{status}</span> : <span className="flex-1" />}
        <span className="flex items-center gap-2">{children}</span>
      </div>
    </div>
  );
}

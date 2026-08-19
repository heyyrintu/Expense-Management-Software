import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * EmptyState (§6.1): a thin-stroke mark in a 48px bg-subtle circle, a
 * one-line headline, one line of explanation, and a single action.
 *
 * Never an apologetic paragraph — "No expenses yet" and a button, not
 * "Sorry, we couldn't find anything!". Copy voice is design-craft law.
 */
function EmptyState({
  icon,
  headline,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  headline: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "grid justify-items-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="bg-bg-subtle text-text-tertiary grid size-12 place-items-center rounded-full"
      >
        {icon ?? <DefaultMark />}
      </span>
      <div className="grid gap-1">
        <p className="text-h3 text-text-primary">{headline}</p>
        {description ? (
          <p className="text-body text-text-secondary max-w-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

function DefaultMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10h16M9 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export { EmptyState };

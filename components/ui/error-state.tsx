import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * ErrorState (D0.5) — EmptyState's counterpart, and the third of the
 * empty/loading/error trio every screen owes (design-craft).
 *
 * Shape-matched to EmptyState on purpose: same 48px mark, same one-line
 * headline, same single action. An error is not a different kind of screen,
 * it is the same screen with nothing on it and a way forward.
 *
 * COPY VOICE is the point of this component existing. "Something went wrong"
 * tells the reader nothing they didn't already know, and an exclamation mark
 * makes it worse. Say what failed and what to do: "Couldn't load your
 * expenses" + "Try again". No apologies, no blame, no jargon.
 *
 * The action is REQUIRED. An error state without a recovery path is a dead
 * end, and a dead end is a bug — so the type won't let you ship one.
 */
function ErrorState({
  headline,
  description,
  action,
  tone = "danger",
  className,
}: {
  headline: string;
  description?: string;
  action: React.ReactNode;
  /** `danger` for a genuine failure; `neutral` for expected dead ends (404). */
  tone?: "danger" | "neutral";
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn("grid justify-items-center gap-3 px-6 py-12 text-center", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-12 place-items-center rounded-full",
          tone === "danger"
            ? "bg-status-danger-subtle text-status-danger-text"
            : "bg-bg-subtle text-text-tertiary"
        )}
      >
        <AlertMark />
      </span>
      <div className="grid gap-1">
        <p className="text-h3 text-text-primary">{headline}</p>
        {description ? (
          <p className="text-body text-text-secondary max-w-sm">{description}</p>
        ) : null}
      </div>
      <div className="mt-1">{action}</div>
    </div>
  );
}

function AlertMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="15.75" r="0.9" fill="currentColor" />
    </svg>
  );
}

export { ErrorState };

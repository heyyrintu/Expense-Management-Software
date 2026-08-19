import * as React from "react";

import { DateCell } from "@/components/ui/date-cell";
import { TONE_CLASSES } from "@/lib/design/status";
import type { TimelineStep } from "@/lib/domain/report-timeline";
import { cn } from "@/lib/utils";

/**
 * StatusTimeline (D2.3) — the horizontal stepper §7.2 asks for.
 *
 * Submitted → Approved → Paid, with timestamps, the current step in accent.
 *
 * An ordered list, not a row of divs: this is a sequence, and a screen reader
 * should hear it as one. Each step's state is in its text too — "done",
 * "current" — because a filled dot and an outline dot are the same shape to
 * anyone who can't see the accent (§5.1: never colour alone).
 *
 * Horizontal from sm up, VERTICAL below it. Three steps with timestamps do
 * not fit across 360px, and a stepper that truncates its own dates is worse
 * than one that stacks.
 */
export function StatusTimeline({
  steps,
  className,
}: {
  steps: TimelineStep[];
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "border-line bg-bg-surface grid gap-4 rounded-lg border p-4 sm:grid-flow-col sm:auto-cols-fr",
        className
      )}
    >
      {steps.map((step, index) => {
        const stopped = step.state === "stopped";
        const done = step.state === "done";
        const current = step.state === "current";

        return (
          <li key={step.key} className="grid gap-1">
            <div className="flex items-center gap-2">
              <Marker state={step.state} />
              <span
                className={cn(
                  "text-label",
                  stopped
                    ? TONE_CLASSES.danger.text
                    : current
                      ? "text-accent-text"
                      : done
                        ? "text-text-primary"
                        : "text-text-tertiary"
                )}
              >
                {step.note ?? step.label}
              </span>
              {/* The connector is decorative and hidden from assistive tech —
                  the list order already conveys the sequence. */}
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "hidden h-px flex-1 sm:block",
                    done ? "bg-accent-border" : "bg-line"
                  )}
                />
              ) : null}
            </div>

            <span className="flex items-center gap-2 pl-4">
              {step.at ? (
                <DateCell value={step.at} tone="muted" />
              ) : (
                <span className="text-meta text-text-tertiary">
                  {stopped ? "—" : "Not yet"}
                </span>
              )}
              {/* State in words, for anyone the colour doesn't reach. */}
              <span className="sr-only">
                {stopped ? "stopped here" : done ? "done" : current ? "in progress" : "upcoming"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The dot. Filled when done, ringed when current, hollow when upcoming — a
 * shape difference, so the step's state survives greyscale.
 */
function Marker({ state }: { state: TimelineStep["state"] }) {
  if (state === "stopped") {
    return (
      <span
        aria-hidden="true"
        className={cn("grid size-2.5 shrink-0 place-items-center rounded-full", "bg-status-danger")}
      />
    );
  }
  if (state === "done") {
    return <span aria-hidden="true" className="bg-accent size-2.5 shrink-0 rounded-full" />;
  }
  if (state === "current") {
    return (
      <span
        aria-hidden="true"
        className="border-accent bg-bg-surface size-2.5 shrink-0 rounded-full border-2"
      />
    );
  }
  return <span aria-hidden="true" className="bg-line-strong size-2.5 shrink-0 rounded-full" />;
}

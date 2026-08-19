"use client";

// SegmentedControl (D4.1) — §7.5's entity switcher.
//
// Not `Tabs`. Tabs owns panels and expects `TabsContent` beneath it; this
// switches a SERVER-rendered view by changing the URL, so there is no panel
// to own and no local state to keep. Reusing Tabs would have meant a
// component that hides the thing it is supposed to reveal.
//
// The indicator is the same shared-layout trick Tabs uses — one motion
// element with a stable layoutId, so it SLIDES between options instead of
// disappearing here and reappearing there. It is a filled pill rather than a
// bottom rule, because a segmented control is a choice among peers and a
// tab strip is a set of destinations.
import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { DURATION, EASE, seconds } from "@/lib/motion";

export type Segment<T extends string> = {
  value: T;
  label: string;
  /** Announced to screen readers when the label alone is ambiguous. */
  hint?: string;
};

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  className,
}: {
  segments: Array<Segment<T>>;
  value: T;
  onChange: (next: T) => void;
  /** Names the group for assistive tech — "Ledger entity", not "Tabs". */
  label: string;
  className?: string;
}) {
  const groupId = React.useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "bg-bg-subtle inline-flex items-center gap-1 rounded-md p-1",
        className
      )}
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={segment.hint}
            onClick={() => onChange(segment.value)}
            className={cn(
              // 36px inside a 44px group — the padded container clears the
              // touch target without every pill being finger-sized.
              "relative inline-flex h-9 items-center rounded-sm px-3 text-label",
              "transition-colors duration-instant ease-out",
              "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
              active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${groupId}-segment`}
                className="bg-bg-surface border-line absolute inset-0 rounded-sm border shadow-xs"
                transition={{ duration: seconds(DURATION.base), ease: [...EASE.out] }}
              />
            ) : null}
            {/* Above the indicator, or the pill would cover its own label. */}
            <span className="relative">{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}

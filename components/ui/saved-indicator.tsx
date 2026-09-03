"use client";

// "Saved" indicator (D2.1).
//
// Confirms a save happened and then gets out of the way — 2s, then it fades.
// A permanent "Saved" badge stops meaning anything within a minute; one that
// leaves is the difference between feedback and decoration.
//
// It reports a SAVE THAT ACTUALLY HAPPENED. It is driven by the save
// completing, never by a timer that fires hopefully.
import * as React from "react";
import { AnimatePresence, m } from "framer-motion";
import { Check } from "lucide-react";

import { DURATION, EASE, seconds } from "@/lib/motion";
import { TONE_CLASSES } from "@/lib/design/status";
import { cn } from "@/lib/utils";

export const SAVED_VISIBLE_MS = 2000;

export function SavedIndicator({
  /** Bump this on every successful save — a counter, not a boolean, so two
   *  saves in a row each show rather than the second being swallowed. */
  savedAt,
  label = "Saved",
  className,
}: {
  savedAt: number | null;
  label?: string;
  className?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (savedAt === null) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), SAVED_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [savedAt]);

  return (
    <AnimatePresence>
      {visible ? (
        <m.span
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: seconds(DURATION.fast), ease: [...EASE.out] },
          }}
          exit={{
            opacity: 0,
            // Slower on the way out: an acknowledgement should recede, not
            // be snatched away.
            transition: { duration: seconds(DURATION.base), ease: [...EASE.in] },
          }}
          role="status"
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-1 text-meta",
            TONE_CLASSES.success.text,
            className
          )}
        >
          <Check aria-hidden="true" className="size-3" />
          {label}
        </m.span>
      ) : null}
    </AnimatePresence>
  );
}

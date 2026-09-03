"use client";

// Floating bulk action bar (D1.2, §7.2).
//
// Appears when a selection exists and slides up from the bottom edge — the
// edge it belongs to (§4.4 "elements animate from their origin"). 200ms
// ease-out in, and out on ease-in, both from lib/motion.ts.
//
// It is `fixed`, so it floats over the content rather than pushing it: a bar
// that reflows the table on every selection change would move the row you
// were about to click.
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { DURATION, EASE, seconds } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BulkActionBar({
  count,
  onClear,
  children,
  className,
}: {
  count: number;
  onClear: () => void;
  /** The screen's actions. One primary at most (§4.6). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          // Transform and opacity only. y is a transform, so this costs
          // nothing to animate and reduced motion drops it to a fade.
          initial={{ opacity: 0, y: 16 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: seconds(DURATION.base), ease: [...EASE.out] },
          }}
          exit={{
            opacity: 0,
            y: 16,
            transition: { duration: seconds(DURATION.fast), ease: [...EASE.in] },
          }}
          className={cn(
            // Sits above the mobile tab bar, centred on the content column.
            "fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-tabbar md:pb-6",
            "pointer-events-none print:hidden",
            className
          )}
        >
          <div
            role="region"
            aria-label="Bulk actions"
            className={cn(
              "border-line bg-bg-surface shadow-overlay pointer-events-auto",
              "flex max-w-content flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
            )}
          >
            {/* aria-live so a screen-reader user hears the count change
                without having to go looking for the bar. */}
            <span className="text-label text-text-primary tabular" aria-live="polite">
              {count} selected
            </span>
            <Button size="sm" variant="ghost" onClick={onClear}>
              Clear
            </Button>
            {children ? <span className="flex items-center gap-2">{children}</span> : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

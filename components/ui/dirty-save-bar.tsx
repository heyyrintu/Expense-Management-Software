"use client";

// Sticky save bar (D4.4) — the settings form pattern.
//
// ── WHY IT APPEARS ONLY WHEN DIRTY ────────────────────────────────────────
// A permanently visible "Save changes" button on a settings screen is a
// button that is wrong most of the time: nothing has changed, so pressing it
// does nothing, and a reader who has genuinely edited a field has no signal
// that the app noticed. Appearing on the first edit turns the bar itself into
// the confirmation that something is unsaved — and its absence into the
// confirmation that everything is stored.
//
// "Discard" sits beside Save because the bar creates the obligation: once a
// reader knows they have unsaved edits, they need a way out that isn't
// reloading the page and hoping.
//
// MOTION: slides up 8px and fades, 200ms ease-out, exiting with ease-in.
// Transform and opacity only, so it never triggers layout — the reserved
// space below is permanent, and the bar moves within it.
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { DURATION, EASE, seconds } from "@/lib/motion";

export function DirtySaveBar({
  dirty,
  pending = false,
  onDiscard,
  /** Omit when the bar sits inside a <form> and Save is a submit button. */
  onSave,
  saveLabel = "Save changes",
  message,
}: {
  dirty: boolean;
  pending?: boolean;
  onDiscard: () => void;
  onSave?: () => void;
  saveLabel?: string;
  /** Replaces the default "unsaved changes" line — e.g. a validation note. */
  message?: string;
}) {
  return (
    <AnimatePresence>
      {dirty ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{
            duration: seconds(DURATION.base),
            ease: [...EASE.out],
          }}
          className="sticky bottom-0 z-20 -mx-1 px-1 pb-1"
        >
          <div className="border-line bg-bg-surface shadow-overlay flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-meta text-text-secondary">
              {message ?? "You have unsaved changes."}
            </span>
            <span className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onDiscard}
                disabled={pending}
              >
                Discard
              </Button>
              <Button
                type={onSave ? "button" : "submit"}
                onClick={onSave}
                disabled={pending}
              >
                {pending ? "Saving…" : saveLabel}
              </Button>
            </span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

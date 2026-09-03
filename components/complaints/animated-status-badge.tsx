"use client";

// Complaint status badge with a crossfade (D4.3).
//
// §7.7 asks for the badge to animate on a status change: 150ms, opacity only.
//
// ── WHY THIS IS A SEPARATE COMPONENT ──────────────────────────────────────
// `ComplaintStatusBadge` is a server-renderable span and most of its call
// sites — table cells, list rows — never see a status change without a full
// re-render. Animating there would mean making every one of them a client
// component to buy nothing.
//
// This wrapper is for the two places where the status genuinely changes under
// the reader's eyes: the thread header when finance resolves, and the inbox
// row that just moved. The crossfade communicates "this changed" — the one
// thing a reader would otherwise miss, because a badge swapping instantly
// looks like it was always that way.
//
// Opacity only, so `prefers-reduced-motion` keeps the fade and loses nothing
// (a fade IS the reduced-motion fallback). AnimatePresence with mode="wait"
// would double the duration to 300ms; "popLayout" crossfades in place, and
// the wrapper reserves the box so nothing beside it shifts.
import { AnimatePresence, motion } from "framer-motion";

import { ComplaintStatusBadge } from "@/components/sla-badge";
import type { ComplaintStatus } from "@/lib/domain/complaint";
import { DURATION, EASE, seconds } from "@/lib/motion";

export function AnimatedStatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span className="relative inline-grid">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: seconds(DURATION.fast),
            // Enter with ease-out, and the exit overlaps rather than queues.
            ease: [...EASE.out],
          }}
          className="col-start-1 row-start-1"
        >
          <ComplaintStatusBadge status={status} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

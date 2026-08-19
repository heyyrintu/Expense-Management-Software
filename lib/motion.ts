// Motion primitives (D0.2). DESIGN-PRD §4 principle 4 and §5.6, in code.
//
// These constants and variants are the ONLY source of duration, easing and
// spring in the app. A component that writes its own numbers has opted out
// of the design system, and the rules below stop being enforceable.
//
// The rules, restated so they are visible where they are used:
//   * Enters use EASE.out. Exits use EASE.in. Never ease-in-out for UI.
//   * 150–250ms is the normal range; 300ms (DURATION.slow) is the ceiling.
//   * Animate transform and opacity ONLY — never width, height, top, left
//     or margin. collapseRow is the one deliberate exception, explained
//     where it is defined.
//   * Every animation is interruptible: no variant leaves state behind on
//     completion, so a fast double-click can never strand the UI.
//   * Elements animate from their origin — a dropdown scales from its
//     trigger, a sheet slides from the edge it belongs to.
//   * Springs for things that feel physical (sheets, toasts); duration
//     easing for everything else. Sheets are Vaul's; it owns that spring.
//   * prefers-reduced-motion removes transforms and springs, keeps opacity.
import type { Transition, Variants } from "framer-motion";

/** Milliseconds. Mirrors --dur-* in app/globals.css. */
export const DURATION = {
  instant: 100, // hover, focus, colour change
  fast: 150, // dropdowns, tooltips, checkbox
  base: 200, // modals, toasts, tab switches
  slow: 300, // sheets, page transitions — the hard ceiling
} as const;

/** The project's two curves. Mirrors --ease-enter / --ease-exit. */
export const EASE = {
  out: [0.16, 1, 0.3, 1], // every enter
  in: [0.4, 0, 1, 1], // every exit
} as const;

/** Physics for draggable / physical surfaces. */
export const SPRING = {
  soft: { stiffness: 300, damping: 30 }, // sheets, drawers
  snappy: { stiffness: 500, damping: 35 }, // toasts, popovers
} as const;

/** Seconds — Framer takes seconds, the token layer is in milliseconds. */
export function seconds(ms: number): number {
  return ms / 1000;
}

export const enterTransition = (ms: number = DURATION.fast): Transition => ({
  duration: seconds(ms),
  ease: [...EASE.out],
});

export const exitTransition = (ms: number = DURATION.fast): Transition => ({
  duration: seconds(ms),
  ease: [...EASE.in],
});

export const springTransition = (
  spring: keyof typeof SPRING = "soft"
): Transition => ({
  type: "spring",
  ...SPRING[spring],
});

// ---------------------------------------------------------------------------
// Shared variants
// ---------------------------------------------------------------------------

/**
 * fadeScale — dropdowns, popovers, tooltips, dialog content.
 * Scales from 0.96 so it reads as arriving rather than appearing. Pair with
 * a transform-origin at the trigger so it grows FROM its origin (§4.4).
 */
export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: enterTransition(DURATION.fast),
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: exitTransition(DURATION.instant),
  },
};

// slideUpSheet was REMOVED in D5.2. Sheets are Vaul (`components/ui/sheet`),
// which owns its own spring and drag physics, so the variant governed nothing
// while appearing to define sheet motion — the most misleading kind of dead
// code in a file whose whole job is to be the single source of truth.

/**
 * collapseRow — a row leaving a list after an optimistic action (approve
 * with undo, discard, unmatch).
 *
 * THE ONE EXCEPTION to "transform and opacity only": collapsing a row
 * requires animating height, because the rows below have to close the gap.
 * Nothing else may animate layout. Height is animated on its own, opacity
 * leads it out so the content is gone before the space closes, and the
 * whole thing stays under the ceiling.
 */
export const collapseRow: Variants = {
  visible: { opacity: 1, height: "auto" },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      opacity: exitTransition(DURATION.instant),
      height: { duration: seconds(DURATION.fast), ease: [...EASE.in] },
    },
  },
};

// staggerList / staggerItem / staggerFor / STAGGER_* were REMOVED in D5.2.
//
// A stagger on a list's first paint communicates nothing: the rows are not
// arriving in a meaningful order, they are all already there, and the effect
// only delays the last one. That is the definition of decorative motion, and
// §4 principle 4 says delete it rather than tune it. Nothing in the app ever
// used them — only the gallery demo that existed to show them off.

// fadeOnly was REMOVED in D5.2. MOTION_CONFIG's `reducedMotion: "user"`
// already strips transforms and keeps opacity for every component at once,
// so a hand-reachable variant was a second way to do the thing the provider
// does — and the two could disagree.

/**
 * Global Framer configuration, applied by MotionProvider in the root layout.
 *
 * `reducedMotion: "user"` is what makes the whole app honour the OS setting:
 * Framer drops transform and layout animations and keeps opacity, and
 * springs resolve instantly. Exported as data so it can be asserted in a
 * test — a silent regression here would quietly break accessibility for
 * everyone who needs it.
 */
export const MOTION_CONFIG = {
  reducedMotion: "user",
  transition: {
    duration: seconds(DURATION.fast),
    ease: [...EASE.out],
  },
} as const satisfies { reducedMotion: "user" | "always" | "never"; transition: Transition };

/** Properties that may be animated. Anything else is a layout property. */
export const ANIMATABLE_PROPERTIES = [
  "opacity",
  "scale",
  "scaleX",
  "scaleY",
  "x",
  "y",
  "rotate",
  "transition",
] as const;

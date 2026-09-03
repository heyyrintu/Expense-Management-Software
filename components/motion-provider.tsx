"use client";

// Global motion configuration (D0.2).
//
// Three jobs:
//   1. Give every Framer animation the project's default transition, so a
//      component that forgets to pass one still lands on the right curve.
//   2. Honour prefers-reduced-motion. MotionConfig's `reducedMotion="user"`
//      makes Framer strip transform and layout animations while KEEPING
//      opacity — exactly the behaviour DESIGN-PRD §4.4 asks for. Springs
//      collapse to instant, so nothing bounces.
//   3. Keep the animation runtime OFF the critical path. Components render
//      `m.*` elements, which know nothing about how to animate; the
//      features load through LazyMotion from lib/motion-features.ts in
//      their own chunk. `strict` makes a stray `motion.*` throw in
//      development rather than quietly pulling the whole runtime back in —
//      and the ESLint rule in eslint.config.mjs catches the import before
//      the component ever renders.
//
// The CSS side of reduced motion (transitions on plain elements) is handled
// by the media query in app/globals.css. Both are needed: this covers
// JS-driven animation, that covers CSS.
import { LazyMotion, MotionConfig } from "framer-motion";

import { MOTION_CONFIG } from "@/lib/motion";

const loadFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion={MOTION_CONFIG.reducedMotion}
      transition={MOTION_CONFIG.transition}
    >
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}

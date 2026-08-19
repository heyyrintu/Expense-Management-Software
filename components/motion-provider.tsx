"use client";

// Global motion configuration (D0.2).
//
// Two jobs:
//   1. Give every Framer animation the project's default transition, so a
//      component that forgets to pass one still lands on the right curve.
//   2. Honour prefers-reduced-motion. MotionConfig's `reducedMotion="user"`
//      makes Framer strip transform and layout animations while KEEPING
//      opacity — exactly the behaviour DESIGN-PRD §4.4 asks for. Springs
//      collapse to instant, so nothing bounces.
//
// The CSS side of reduced motion (transitions on plain elements) is handled
// by the media query in app/globals.css. Both are needed: this covers
// JS-driven animation, that covers CSS.
import { MotionConfig } from "framer-motion";

import { MOTION_CONFIG } from "@/lib/motion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion={MOTION_CONFIG.reducedMotion}
      transition={MOTION_CONFIG.transition}
    >
      {children}
    </MotionConfig>
  );
}

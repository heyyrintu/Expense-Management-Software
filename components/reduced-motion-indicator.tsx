"use client";

// Shows whether the browser is currently asking for reduced motion. Used in
// the /design-system gallery so the setting can be verified without guessing
// — flip the OS toggle and this flips with it.
import { useReducedMotion } from "framer-motion";

export function ReducedMotionIndicator() {
  const reduced = useReducedMotion();
  return (
    <span
      role="status"
      className={`rounded-sm px-2 py-1 text-meta ${
        reduced
          ? "bg-status-warning-subtle text-status-warning-text"
          : "bg-status-success-subtle text-status-success-text"
      }`}
    >
      {reduced
        ? "Reduced motion ON — transforms and springs are stripped, fades remain"
        : "Reduced motion off — full motion"}
    </span>
  );
}

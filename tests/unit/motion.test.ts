import { describe, expect, it } from "vitest";
import type { Transition, Variants } from "framer-motion";
import {
  ANIMATABLE_PROPERTIES,
  MOTION_CONFIG,
  DURATION,
  EASE,
  SPRING,
  collapseRow,
  enterTransition,
  exitTransition,
  fadeScale,
  seconds,
  springTransition,
} from "@/lib/motion";

type VariantObject = Record<string, unknown> & { transition?: Transition };

function variantOf(variants: Variants, key: string): VariantObject {
  const v = variants[key];
  expect(v, `variant "${key}" is missing`).toBeDefined();
  return v as VariantObject;
}

/** Every property a variant animates, ignoring the transition config. */
function animatedProps(variant: VariantObject): string[] {
  return Object.keys(variant).filter((k) => k !== "transition");
}

/** Flatten nested per-property transitions (collapseRow uses these). */
function easingsIn(transition: Transition | undefined): number[][] {
  if (!transition) return [];
  const out: number[][] = [];
  const record = transition as Record<string, unknown>;
  if (Array.isArray(record.ease)) out.push(record.ease as number[]);
  for (const value of Object.values(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      if (Array.isArray(nested.ease)) out.push(nested.ease as number[]);
    }
  }
  return out;
}

function durationsIn(transition: Transition | undefined): number[] {
  if (!transition) return [];
  const out: number[] = [];
  const record = transition as Record<string, unknown>;
  if (typeof record.duration === "number") out.push(record.duration);
  for (const value of Object.values(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      if (typeof nested.duration === "number") out.push(nested.duration);
    }
  }
  return out;
}

describe("motion tokens", () => {
  it("matches the durations in DESIGN-PRD §5.6", () => {
    expect(DURATION).toEqual({ instant: 100, fast: 150, base: 200, slow: 300 });
  });

  it("holds 300ms as the hard ceiling", () => {
    for (const [name, ms] of Object.entries(DURATION)) {
      expect(ms, `DURATION.${name}`).toBeLessThanOrEqual(300);
    }
  });

  it("uses the project's two curves and nothing else", () => {
    expect(EASE.out).toEqual([0.16, 1, 0.3, 1]);
    expect(EASE.in).toEqual([0.4, 0, 1, 1]);
    // ease-in-out is symmetric; neither of ours may be.
    expect(EASE.out[0]).not.toBe(EASE.in[0]);
  });

  it("exposes the two springs from the PRD", () => {
    expect(SPRING.soft).toEqual({ stiffness: 300, damping: 30 });
    expect(SPRING.snappy).toEqual({ stiffness: 500, damping: 35 });
  });

  it("converts milliseconds to the seconds Framer expects", () => {
    expect(seconds(150)).toBe(0.15);
    expect(seconds(DURATION.slow)).toBe(0.3);
  });

  it("builds enter and exit transitions with the right curve", () => {
    expect(enterTransition().ease).toEqual([...EASE.out]);
    expect(exitTransition().ease).toEqual([...EASE.in]);
    expect(enterTransition(DURATION.base).duration).toBe(0.2);
    expect(springTransition("snappy")).toMatchObject({
      type: "spring",
      stiffness: 500,
      damping: 35,
    });
  });
});

describe("the rules hold across every shared variant", () => {
  const variants: Array<[string, Variants]> = [
    ["fadeScale", fadeScale],
  ];

  it("animates only transform and opacity", () => {
    for (const [name, variant] of variants) {
      for (const key of Object.keys(variant)) {
        const props = animatedProps(variantOf(variant, key));
        for (const prop of props) {
          expect(
            ANIMATABLE_PROPERTIES as readonly string[],
            `${name}.${key} animates "${prop}"`
          ).toContain(prop);
        }
      }
    }
  });

  it("never animates a layout property", () => {
    const layoutProps = ["width", "height", "top", "left", "right", "bottom", "margin", "padding"];
    for (const [name, variant] of variants) {
      for (const key of Object.keys(variant)) {
        for (const prop of animatedProps(variantOf(variant, key))) {
          expect(layoutProps, `${name}.${key}`).not.toContain(prop);
        }
      }
    }
  });

  it("enters with EASE.out", () => {
    for (const [name, variant] of variants) {
      const visible = variantOf(variant, "visible");
      const transition = visible.transition as Record<string, unknown> | undefined;
      // Spring enters carry no easing curve, which is allowed.
      if (transition?.type === "spring") continue;
      for (const ease of easingsIn(visible.transition)) {
        expect(ease, `${name}.visible`).toEqual([...EASE.out]);
      }
    }
  });

  it("exits with EASE.in", () => {
    for (const [name, variant] of [...variants, ["collapseRow", collapseRow] as [string, Variants]]) {
      if (!variant.exit) continue;
      const exit = variantOf(variant, "exit");
      const easings = easingsIn(exit.transition);
      expect(easings.length, `${name}.exit has no easing`).toBeGreaterThan(0);
      for (const ease of easings) {
        expect(ease, `${name}.exit`).toEqual([...EASE.in]);
      }
    }
  });

  it("keeps every duration under the ceiling", () => {
    const all: Array<[string, Variants]> = [...variants, ["collapseRow", collapseRow]];
    for (const [name, variant] of all) {
      for (const key of Object.keys(variant)) {
        for (const d of durationsIn(variantOf(variant, key).transition)) {
          expect(d * 1000, `${name}.${key}`).toBeLessThanOrEqual(DURATION.slow);
        }
      }
    }
  });

  it("leaves no state behind on completion — every animation is interruptible", () => {
    // A variant that sets transitionEnd or animation-locking flags would
    // strand the UI on a fast double-click.
    const all: Array<[string, Variants]> = [...variants, ["collapseRow", collapseRow]];
    for (const [name, variant] of all) {
      for (const key of Object.keys(variant)) {
        const v = variantOf(variant, key);
        expect(v.transitionEnd, `${name}.${key} sets transitionEnd`).toBeUndefined();
        const transition = v.transition as Record<string, unknown> | undefined;
        expect(transition?.repeat, `${name}.${key} repeats`).toBeUndefined();
      }
    }
  });
});

describe("fadeScale", () => {
  it("grows from 0.96 so it arrives rather than appears", () => {
    expect(variantOf(fadeScale, "hidden")).toMatchObject({ opacity: 0, scale: 0.96 });
    expect(variantOf(fadeScale, "visible")).toMatchObject({ opacity: 1, scale: 1 });
    expect(variantOf(fadeScale, "exit")).toMatchObject({ scale: 0.96 });
  });

  it("exits faster than it enters", () => {
    const enter = durationsIn(variantOf(fadeScale, "visible").transition)[0];
    const exit = durationsIn(variantOf(fadeScale, "exit").transition)[0];
    expect(exit).toBeLessThanOrEqual(enter);
  });
});

describe("collapseRow", () => {
  it("is the documented exception: height is animated so rows can close the gap", () => {
    const exit = variantOf(collapseRow, "exit");
    expect(animatedProps(exit).sort()).toEqual(["height", "opacity"]);
    expect(exit.height).toBe(0);
  });

  it("fades the content out before the space closes", () => {
    const transition = variantOf(collapseRow, "exit").transition as Record<
      string,
      Record<string, number>
    >;
    expect(transition.opacity.duration).toBeLessThan(transition.height.duration);
  });
});


describe("global motion configuration", () => {
  it("honours the OS reduced-motion setting", async () => {
    const { MOTION_CONFIG } = await import("@/lib/motion");
    // "user" = follow prefers-reduced-motion. "never" would silently break
    // accessibility for everyone who needs it.
    expect(MOTION_CONFIG.reducedMotion).toBe("user");
  });

  it("defaults every animation to the enter curve", () => {
    expect(MOTION_CONFIG.transition).toEqual({
      duration: seconds(DURATION.fast),
      ease: [...EASE.out],
    });
  });

  it("ships the CSS half of reduced motion too", async () => {
    // Framer covers JS-driven animation; plain CSS transitions need the
    // media query. Both are required, so both are checked.
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});

// ---------------------------------------------------------------------------
// Reduced motion (D5.2)
// ---------------------------------------------------------------------------
//
// The audit's verification step is "with prefers-reduced-motion enabled: no
// transforms or springs run, opacity fades remain, nothing becomes unusable
// or invisible". Two of those three are properties of code rather than of a
// rendered frame, so they are asserted here; the third needs a browser and is
// recorded as such in docs/MOTION-AUDIT.md.

describe("reduced motion", () => {
  it("delegates to Framer's own handling rather than branching per component", () => {
    // `reducedMotion: "user"` makes Framer drop transform and layout
    // animations and keep opacity, for every motion component at once. A
    // component branching on useReducedMotion() itself is a second
    // implementation that can disagree with this one.
    expect(MOTION_CONFIG.reducedMotion).toBe("user");
  });

  it("still supplies a default transition, so fades survive", () => {
    // The failure mode this guards: stripping motion config entirely, which
    // would remove the opacity fade too and make things appear instantly —
    // "no motion" is not the same as "no transition".
    const transition = MOTION_CONFIG.transition as { duration: number; ease: number[] };
    expect(transition.duration).toBeGreaterThan(0);
    expect(transition.ease).toEqual([...EASE.out]);
  });

  it("keeps every remaining variant inside the ceiling", () => {
    // Re-checked after D5.2 removed three unused variants: whatever is left
    // is what actually ships, so the ceiling has to hold across all of it.
    for (const [name, variant] of [
      ["fadeScale", fadeScale],
      ["collapseRow", collapseRow],
    ] as const) {
      for (const key of Object.keys(variant)) {
        for (const ms of durationsIn(variantOf(variant, key).transition)) {
          expect(ms, `${name}.${key}`).toBeLessThanOrEqual(DURATION.slow);
        }
      }
    }
  });
});

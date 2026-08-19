// Chart theme (D1.4). Recharts takes colour as a prop, not a class, so these
// values are DUPLICATED from the token layer rather than derived from it —
// which means only a test can stop them drifting apart.
import { describe, expect, it } from "vitest";

import {
  CHART_ACCENT,
  CHART_ANIMATION_MS,
  CHART_AXIS_COLOR,
  CHART_AXIS_FONT_SIZE,
  CHART_GRID_OPACITY,
  CHART_GRID_STROKE,
  CHART_SERIES,
  animationProps,
  axisProps,
  describeSeries,
  gridProps,
  seriesColor,
} from "@/lib/charts/theme";
import { COLOR_GROUPS, contrastRatio } from "@/lib/design/tokens";

/** Look a token's hex up from the registry the gallery renders. */
function token(name: string): string {
  for (const group of COLOR_GROUPS) {
    const found = group.tokens.find((t) => t.name === name);
    if (found) return found.hex.toLowerCase();
  }
  throw new Error(`no such token: ${name}`);
}

describe("chart theme tracks the token layer", () => {
  it("uses the accent for the primary series", () => {
    expect(CHART_ACCENT).toBe(token("accent"));
  });

  it("draws the grid in --line", () => {
    expect(CHART_GRID_STROKE.toLowerCase()).toBe(token("line"));
  });

  it("labels axes in --text-tertiary at the meta size", () => {
    expect(CHART_AXIS_COLOR.toLowerCase()).toBe(token("text-tertiary"));
    expect(CHART_AXIS_FONT_SIZE).toBe(12);
  });

  it("keeps the grid at half opacity — present, not loud", () => {
    expect(CHART_GRID_OPACITY).toBe(0.5);
    expect(gridProps.strokeOpacity).toBe(0.5);
  });
});

describe("categorical palette", () => {
  it("leads with the accent", () => {
    expect(CHART_SERIES[0]).toBe(CHART_ACCENT);
  });

  it("has five distinct entries — no duplicates to confuse two series", () => {
    expect(new Set(CHART_SERIES).size).toBe(CHART_SERIES.length);
  });

  it("is not a rainbow: every series is legible on the surface", () => {
    // 3:1 is the WCAG floor for non-text UI. A series colour that fails it is
    // a series nobody can find on the chart.
    for (const color of CHART_SERIES) {
      expect(contrastRatio(color, "#FFFFFF"), color).toBeGreaterThanOrEqual(3);
    }
  });

  it("cycles rather than running out", () => {
    expect(seriesColor(0)).toBe(CHART_SERIES[0]);
    expect(seriesColor(CHART_SERIES.length)).toBe(CHART_SERIES[0]);
    expect(seriesColor(CHART_SERIES.length + 2)).toBe(CHART_SERIES[2]);
  });
});

describe("chart motion", () => {
  it("draws in at the 300ms ceiling, never beyond", () => {
    expect(CHART_ANIMATION_MS).toBe(300);
    expect(CHART_ANIMATION_MS).toBeLessThanOrEqual(300);
  });

  it("turns animation off entirely under reduced motion", () => {
    expect(animationProps(true).isAnimationActive).toBe(false);
    expect(animationProps(false).isAnimationActive).toBe(true);
    expect(animationProps(null).isAnimationActive).toBe(true);
  });
});

describe("chart junk", () => {
  it("has no vertical grid rules on a categorical axis", () => {
    expect(gridProps.vertical).toBe(false);
  });

  it("has no tick lines", () => {
    expect(axisProps.tickLine).toBe(false);
  });
});

describe("describeSeries — the accessible summary", () => {
  const fmt = (v: number) => `₹${(v / 100).toFixed(2)}`;

  it("names the range, the endpoints and the peak", () => {
    const summary = describeSeries(
      "Monthly spend",
      [
        { label: "Mar", value: 100 },
        { label: "Apr", value: 900 },
        { label: "May", value: 400 },
      ],
      fmt
    );
    expect(summary).toContain("Monthly spend, 3 points");
    expect(summary).toContain("from Mar at ₹1.00");
    expect(summary).toContain("to May at ₹4.00");
    expect(summary).toContain("peak Apr at ₹9.00");
  });

  it("says so when there is no data, rather than producing NaN", () => {
    expect(describeSeries("Spend", [], fmt)).toBe("Spend: no data");
  });

  it("handles a single point without claiming a range", () => {
    const summary = describeSeries("Spend", [{ label: "Aug", value: 500 }], fmt);
    expect(summary).toContain("1 points");
    expect(summary).not.toContain("NaN");
  });
});

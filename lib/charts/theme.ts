// Recharts theme (D1.4) — DESIGN-PRD §6.2.
//
// WHY CONCRETE VALUES LIVE HERE. Recharts takes colour as a PROP, not a
// class, so a chart cannot reference a Tailwind token the way every other
// component does. This file is the one place those values are written down,
// which is why it sits in lib/ (exempt from the token lint) rather than being
// sprinkled through components/charts. Change the palette here and every
// chart moves at once.
//
// The values mirror the token layer. They are duplicated, not derived, so
// tests/unit/chart-theme.test.ts asserts the accent matches --accent-base —
// otherwise the charts would silently drift away from the rest of the app.

/**
 * Primary series = the accent (§6.2). One accent, used sparingly, so a chart
 * with a single series reads as part of the product rather than as decoration.
 */
export const CHART_ACCENT = "#6366f1"; // --accent-base

/**
 * Categorical palette: the accent plus four DESATURATED hues.
 *
 * Never a rainbow. Fully saturated categorical palettes make every series
 * shout equally, which is the opposite of what a chart is for — and at five
 * or six series they stop being distinguishable to anyone with a common
 * colour-vision deficiency. These four sit at roughly half the accent's
 * chroma so the accent stays the thing your eye lands on, and they are
 * ordered by how different they are from it rather than by hue.
 *
 * Grey is always LAST, so it lands on the "Other" bucket that categorical
 * breakdowns almost always end with.
 */
export const CHART_SERIES = [
  CHART_ACCENT, // indigo — the accent
  "#0d9488", // teal 600, desaturated against the accent
  "#b45309", // amber 700 — the warning -text shade, readable as a fill
  "#9333ea", // violet 600 — adjacent to the accent, distinct in mass
  "#64748b", // slate 500 — "Other", always last
] as const;

/** Single-series bars in a secondary context (category breakdown). */
export const CHART_SECONDARY = CHART_SERIES[1];

/** Cycles for datasets longer than the palette. */
export function seriesColor(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length];
}

/**
 * Grid, axis and tooltip styling (§6.2: no chart junk).
 *
 * The grid is --line at 50% opacity: present enough to read a value against,
 * faint enough that the data is what you see. Axis labels are --text-tertiary
 * at 12px — the meta role, because an axis label is orientation, not content.
 */
export const CHART_GRID_STROKE = "#e4e4e7"; // --line
export const CHART_GRID_OPACITY = 0.5;
export const CHART_AXIS_COLOR = "#a1a1aa"; // --fg-tertiary
export const CHART_AXIS_FONT_SIZE = 12; // --text-meta

/** Props spread onto <CartesianGrid>. Horizontal only — vertical rules on a
 *  categorical axis divide nothing and are the definition of chart junk. */
export const gridProps = {
  stroke: CHART_GRID_STROKE,
  strokeOpacity: CHART_GRID_OPACITY,
  vertical: false,
  strokeDasharray: "3 3",
} as const;

/** Props spread onto <XAxis> / <YAxis>. */
export const axisProps = {
  tick: { fontSize: CHART_AXIS_FONT_SIZE, fill: CHART_AXIS_COLOR },
  tickLine: false,
  axisLine: { stroke: CHART_GRID_STROKE, strokeOpacity: CHART_GRID_OPACITY },
} as const;

/**
 * Mount-only draw-in, 300ms (§6.2, and the §4.4 ceiling).
 *
 * `isAnimationActive` is turned OFF on update: a bar re-growing from zero
 * every time a filter changes is decoration, and worse, it makes the number
 * unreadable for the third of a second you most want to read it.
 */
export const CHART_ANIMATION_MS = 300;

/**
 * Reduced motion has to be resolved at render time, because Recharts takes a
 * boolean prop rather than honouring a CSS media query. Components pass the
 * result of useReducedMotion().
 */
export function animationProps(reducedMotion: boolean | null) {
  return {
    isAnimationActive: !reducedMotion,
    animationDuration: CHART_ANIMATION_MS,
    animationBegin: 0,
  } as const;
}

/**
 * A plain-language summary of a series, for the chart's aria-label.
 *
 * §8 requires charts carry patterns or direct labels; a screen reader gets
 * neither from an SVG of rectangles. This is the accessible equivalent — and
 * the components also render a real <table> behind a toggle, because a
 * summary tells you the shape while a table lets you read the numbers.
 */
export function describeSeries(
  label: string,
  points: Array<{ label: string; value: number }>,
  formatValue: (value: number) => string
): string {
  if (points.length === 0) return `${label}: no data`;
  const first = points[0];
  const last = points[points.length - 1];
  const peak = points.reduce((best, p) => (p.value > best.value ? p : best));
  return [
    `${label}, ${points.length} points`,
    `from ${first.label} at ${formatValue(first.value)}`,
    `to ${last.label} at ${formatValue(last.value)}`,
    `peak ${peak.label} at ${formatValue(peak.value)}`,
  ].join(", ");
}

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
export const CHART_ACCENT = "#35604f"; // --accent-base (laurel, N3.2)

/**
 * Categorical palette (N3.2): laurel plus three DESATURATED companions —
 * sage, slate blue, stone.
 *
 * Never a rainbow. Fully saturated categorical palettes make every series
 * shout equally, which is the opposite of what a chart is for — and past a
 * handful of series they stop being distinguishable to anyone with a common
 * colour-vision deficiency. These sit at roughly half the accent's chroma
 * so the accent stays the thing your eye lands on. Every entry is measured
 * ≥3:1 on white (the test below the token registry holds them to it):
 * laurel 7.15, sage 4.20, slate 5.18, stone 3.72.
 *
 * Stone is always LAST, so it lands on the "Other" bucket that categorical
 * breakdowns almost always end with. Gilt is deliberately NOT in this
 * rotation — see CHART_REIMBURSED.
 */
/**
 * SIX entries, and the count is load-bearing: the analytics trend chart
 * stacks `TREND_TOP_N` (5) categories plus an "Other" band, and seriesColor()
 * CYCLES — so a palette shorter than 6 hands two different bands the same
 * colour and the chart quietly lies. A four-entry version shipped in N3.2 and
 * did exactly that; tests/unit/chart-theme.test.ts now pins
 * CHART_SERIES.length > TREND_TOP_N so it cannot regress silently again.
 *
 * Ordered so ADJACENT entries are the most separated, because in a stacked
 * area chart neighbouring bands share an edge. Every entry clears 3:1 on
 * white (WCAG 1.4.11 for meaningful graphics) and none strays into gilt's
 * warm-gold territory, which is reserved (see CHART_REIMBURSED).
 */
export const CHART_SERIES = [
  CHART_ACCENT, // laurel  #35604f — the accent, 7.15:1
  "#4a6f95", // slate blue      5.25:1
  "#75997f", // sage            3.17:1
  "#6b4f6e", // plum            7.07:1
  "#2f7d7a", // teal            4.84:1
  "#8a8478", // stone — "Other", always last, 3.72:1
] as const;

/**
 * The reimbursed series (N3.2) — gilt, and gilt's ONLY chart appearance
 * per the usage law in app/globals.css: a series may take this colour only
 * when it plots money that has actually been paid out. Never part of the
 * categorical rotation, so an arbitrary fourth category can't come up gold.
 */
export const CHART_REIMBURSED = "#a5761f"; // --gilt-base

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
export const CHART_GRID_STROKE = "#e2dfd7"; // --line (limestone, N3.2)
export const CHART_GRID_OPACITY = 0.5;
// D5.3: follows --fg-tertiary. Axis labels are TEXT a reader has to read,
// not decoration, so the body threshold applies to them.
export const CHART_AXIS_COLOR = "#6b675d"; // --fg-tertiary
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

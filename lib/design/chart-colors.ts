// Chart series palette (D0.1).
//
// Recharts takes colour as a prop, not a class, so these have to be concrete
// values — which is exactly why they live here in lib/design rather than
// inline in a chart component. One list, imported everywhere, so a change to
// the palette moves every chart at once.
//
// Values are unchanged from the pre-token charts: D0.1 relocates them, it
// does not restyle. Aligning the palette with the accent scale is D2's job
// (dashboard and analytics screens).

/** Categorical series, in order. Cycled with modulo for longer datasets. */
export const CHART_SERIES = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#6b7280", // grey — always last, reads as "Other"
] as const;

/** Single-series bars (monthly spend). */
export const CHART_PRIMARY = CHART_SERIES[0];

/** Single-series bars in a secondary context (category breakdown). */
export const CHART_SECONDARY = CHART_SERIES[1];

export function seriesColor(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length];
}

// Dashboard grid (D3.3) — §5.5, 12 columns down to 1.
//
// ── WHY THESE ARE CONSTANTS ───────────────────────────────────────────────
// The task's requirement is "skeletons match the final layout exactly (no
// layout shift on load)". A skeleton that merely LOOKS similar drifts the
// first time a card is resized, and the drift is invisible in review because
// nobody sees the loading state and the loaded state within the same second —
// the reader sees the shift, once, and can't say what moved.
//
// So the page and the skeleton import the same strings. They cannot describe
// different layouts, because there is only one description. Change a span
// here and both move together.
//
// Twelve columns only from `lg`. Below that a 12-column grid on a phone is
// twelve columns of nothing, so the KPI strip goes 1 → 2 → 4 and the panels
// go 1 → 1 → 8/4.
// ──────────────────────────────────────────────────────────────────────────

/** The outer stack: header, filters, KPIs, charts, panels. */
export const DASH_STACK = "grid gap-6";

/** Four KPI cards. Never 3-across — a 4th card alone on a second row reads
 *  as more important than the three above it. */
export const DASH_KPI_GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

/** The chart row: trend takes two thirds, breakdown one third. */
export const DASH_CHART_GRID = "grid gap-4 lg:grid-cols-12";
export const DASH_CHART_MAIN = "lg:col-span-8";
export const DASH_CHART_SIDE = "lg:col-span-4";

/** The list row beneath the charts (top spenders, recent expenses). */
export const DASH_PANEL_GRID = "grid gap-4 lg:grid-cols-12";
export const DASH_PANEL_HALF = "lg:col-span-6";

/** Heights the skeleton reserves. Real content is laid out to match: a
 *  StatCard is label + display value + hint, a chart frame is its fixed
 *  plot area, a panel is a heading plus five rows. */
export const DASH_KPI_HEIGHT = "h-36";
export const DASH_CHART_HEIGHT = "h-80";
export const DASH_PANEL_HEIGHT = "h-80";

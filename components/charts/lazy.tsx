"use client";

// Lazily-loaded charts (D5.4).
//
// ── WHY ───────────────────────────────────────────────────────────────────
// `/dashboard` shipped 342 kB of first-load JS — by far the heaviest route in
// the app, and the one every session lands on. Recharts is ~130 kB of that,
// and it was in the initial bundle because the dashboard's server component
// imported the chart components directly.
//
// Nothing above the fold needs it. The KPI strip is the first thing a reader
// looks at, the charts sit below it, and on a phone they are a scroll away.
// So the charts load after the shell.
//
// `ssr: false` is deliberate rather than incidental: a server-rendered
// Recharts SVG helps nothing (it is a picture of numbers that are also in the
// data table beneath it) and Recharts would still have to ship to the client
// to hydrate it. Rendering it once, late, is strictly cheaper.
//
// ── AND WHY THIS DOESN'T COST CLS ─────────────────────────────────────────
// The fallback is the SAME skeleton ChartFrame renders while loading — a
// 224px plot block plus a row of axis ticks. The box is reserved before the
// chunk arrives, so the content below never moves. A lazy boundary with no
// fallback would trade 130 kB for a layout shift, which is a bad trade on a
// screen whose whole job is being readable at a glance.
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/** Shape-matched to ChartFrame's own loading state. Same heights, same gap. */
function ChartFallback() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-56 w-full rounded-lg" />
      <span className="flex justify-between gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </span>
    </div>
  );
}

export const MonthlyBarChart = dynamic(
  () => import("./monthly-bar").then((m) => m.MonthlyBarChart),
  { ssr: false, loading: ChartFallback }
);

export const BreakdownBarChart = dynamic(
  () => import("./breakdown-bar").then((m) => m.BreakdownBarChart),
  { ssr: false, loading: ChartFallback }
);

export const TrendAreaChart = dynamic(
  () => import("./trend-area").then((m) => m.TrendAreaChart),
  { ssr: false, loading: ChartFallback }
);

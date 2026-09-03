"use client";

// Lazily-loaded charts (D5.4).
//
// ── WHY ───────────────────────────────────────────────────────────────────
// `/dashboard` shipped 342 kB of first-load JS — by far the heaviest route in
// the app, and the one every session lands on. Recharts is ~100 kB gzipped of
// that, and it was in the initial bundle because the dashboard's server
// component imported the chart components directly.
//
// Nothing above the fold needs it. The KPI strip is the first thing a reader
// looks at, the charts sit below it, and on a phone they are a scroll away.
// So the charts load after the shell.
//
// ── AND WHY "AFTER THE SHELL" MEANS "WHEN SCROLLED TO" ────────────────────
// The first version of this file used `next/dynamic` alone, which fetches the
// chunk the moment the boundary renders — i.e. at hydration. On a phone the
// charts start 1,200px down a 727px viewport, so a reader who never scrolled
// still downloaded Recharts, and on a slow connection that 100 kB competed
// with the fonts the LCP paragraph was waiting on. Now the boundary watches
// its own box with an IntersectionObserver and only asks for the chunk once
// the chart is within 200px of the viewport. Desktop readers, whose charts
// are in view on load, see no difference; phone readers download Recharts
// only if they go looking for a chart.
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
// fallback would trade 100 kB for a layout shift, which is a bad trade on a
// screen whose whole job is being readable at a glance.
import * as React from "react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

import type { BreakdownBarChart as BreakdownBarChartImpl } from "./breakdown-bar";
import type { MonthlyBarChart as MonthlyBarChartImpl } from "./monthly-bar";
import type { TrendAreaChart as TrendAreaChartImpl } from "./trend-area";

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

/** How far outside the viewport a chart may be before its chunk is requested. */
const NEAR_VIEWPORT = "200px";

/**
 * True once the element has come within NEAR_VIEWPORT of the viewport; never
 * goes back to false, because unloading a chart the reader scrolled past
 * would only make them download it twice. Browsers without
 * IntersectionObserver get `true` immediately — the old behaviour, not a
 * blank box.
 */
function useNearViewport<T extends Element>(ref: React.RefObject<T | null>): boolean {
  const [near, setNear] = React.useState(false);
  React.useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR_VIEWPORT }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, ref]);
  return near;
}

/**
 * Wrap a `next/dynamic` chart so its chunk is requested only when the chart
 * is near the viewport. The fallback occupies the box from the first paint,
 * so nothing below it moves when the real chart arrives.
 */
function whenNearViewport<P extends object>(
  Chart: React.ComponentType<P>,
  displayName: string
): React.ComponentType<P> {
  function NearViewportChart(props: P) {
    const ref = React.useRef<HTMLDivElement>(null);
    const near = useNearViewport(ref);
    return <div ref={ref}>{near ? <Chart {...props} /> : <ChartFallback />}</div>;
  }
  NearViewportChart.displayName = displayName;
  return NearViewportChart;
}

export const MonthlyBarChart = whenNearViewport<React.ComponentProps<typeof MonthlyBarChartImpl>>(
  dynamic(() => import("./monthly-bar").then((m) => m.MonthlyBarChart), {
    ssr: false,
    loading: ChartFallback,
  }),
  "MonthlyBarChart"
);

export const BreakdownBarChart = whenNearViewport<
  React.ComponentProps<typeof BreakdownBarChartImpl>
>(
  dynamic(() => import("./breakdown-bar").then((m) => m.BreakdownBarChart), {
    ssr: false,
    loading: ChartFallback,
  }),
  "BreakdownBarChart"
);

export const TrendAreaChart = whenNearViewport<React.ComponentProps<typeof TrendAreaChartImpl>>(
  dynamic(() => import("./trend-area").then((m) => m.TrendAreaChart), {
    ssr: false,
    loading: ChartFallback,
  }),
  "TrendAreaChart"
);

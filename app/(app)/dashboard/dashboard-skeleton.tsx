// Dashboard loading state (D3.3).
//
// Every block below reserves the exact box its real counterpart occupies, and
// the grid classes are imported from layout-grid.ts rather than retyped — so
// "matches the final layout" is structural, not a claim someone checked once.
//
// Deliberately NOT animated beyond the skeleton's own opacity pulse: a
// loading screen that slides or fades in makes the wait feel longer, and the
// content that replaces it would then animate twice.
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASH_CHART_GRID,
  DASH_CHART_HEIGHT,
  DASH_CHART_MAIN,
  DASH_CHART_SIDE,
  DASH_KPI_GRID,
  DASH_KPI_HEIGHT,
  DASH_PANEL_GRID,
  DASH_PANEL_HALF,
  DASH_PANEL_HEIGHT,
  DASH_STACK,
} from "./layout-grid";

export function DashboardSkeleton() {
  return (
    <>
      {/* PageHeader: title, description, one action — same pb-6 it uses. */}
      <div className="grid gap-2 pb-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className={DASH_STACK}>
        {/* Filter bar row. */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-11 w-32" />
        </div>

        <div className={DASH_KPI_GRID}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={`${DASH_KPI_HEIGHT} rounded-lg`} />
          ))}
        </div>

        <div className={DASH_CHART_GRID}>
          <Skeleton className={`${DASH_CHART_MAIN} ${DASH_CHART_HEIGHT} rounded-lg`} />
          <Skeleton className={`${DASH_CHART_SIDE} ${DASH_CHART_HEIGHT} rounded-lg`} />
        </div>

        <div className={DASH_PANEL_GRID}>
          <Skeleton className={`${DASH_PANEL_HALF} ${DASH_PANEL_HEIGHT} rounded-lg`} />
          <Skeleton className={`${DASH_PANEL_HALF} ${DASH_PANEL_HEIGHT} rounded-lg`} />
        </div>
      </div>
    </>
  );
}

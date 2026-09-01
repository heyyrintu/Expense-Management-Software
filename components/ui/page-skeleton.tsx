// Route loading skeletons (D5.1).
//
// ── WHY THESE ARE SHARED PRIMITIVES ───────────────────────────────────────
// A skeleton exists to stop the page moving when content lands. That only
// works if it reserves the SAME box the real thing will occupy, which means
// every skeleton is a promise about a layout it doesn't own — and promises
// like that rot silently, because nobody sees the loading state and the
// loaded state within the same second.
//
// So the pieces below are built from the same tokens the real components use:
// `PageHeaderSkeleton` mirrors PageHeader's `grid gap-2 pb-6`, its eyebrow /
// h1 / body line boxes AND its trailing plate rule, `TableSkeleton` mirrors
// the DataTable's `h-row`, and so on.
//
// That rot is not hypothetical: the Neoclassical redesign (N2.1) added an
// eyebrow row and a plate rule to PageHeader and did not touch this file, so
// for one milestone every one of the ~34 routes with a loading.tsx
// under-reserved its header by ~36px and jumped when content landed — while
// the comment above still promised a mirror. Change one, change both.
// A route's loading.tsx composes them in the order its page composes the real
// components, and CLS stays near zero without anyone measuring pixels.
//
// The old skeletons this replaces were three grey boxes in a stack: they
// looked like loading, and then the page jumped.
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Mirrors <PageHeader>: title, optional description, optional action, and
 * the same pb-6 gutter beneath. Every screen starts with one, so every
 * loading.tsx starts with this.
 */
export function PageHeaderSkeleton({
  hasDescription = true,
  hasAction = false,
  hasEyebrow = true,
  hasBreadcrumbs = false,
}: {
  hasDescription?: boolean;
  hasAction?: boolean;
  /**
   * PageHeader derives an eyebrow from the nav model, so nearly every route
   * has one — hence the default. Pass false for routes outside the nav
   * (/profile, /notifications) and for any screen whose eyebrow would repeat
   * its title, since PageHeader suppresses it in both cases.
   */
  hasEyebrow?: boolean;
  /** Breadcrumbs replace the eyebrow on detail routes (PageHeader hides it). */
  hasBreadcrumbs?: boolean;
}) {
  return (
    <div className="grid gap-2 pb-6">
      {/* Breadcrumbs and eyebrow are both a 16px line box, and PageHeader
          renders at most one of them: breadcrumbs win, and the eyebrow is
          suppressed beneath them. */}
      {hasBreadcrumbs || hasEyebrow ? <Skeleton className="h-4 w-24" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          {/* text-h1 is 24px/32px — h-8 is the same 32px line box. */}
          <Skeleton className="h-8 w-56" />
          {hasDescription ? <Skeleton className="h-5 w-80 max-w-full" /> : null}
        </div>
        {hasAction ? <Skeleton className="h-9 w-32 shrink-0" /> : null}
      </div>
      {/* The real header ends in the engraved rule. It is 6px in the box
          model (4px + two 1px borders), and omitting it cost every route
          with a loading.tsx a visible jump when content landed. */}
      <div aria-hidden="true" className="plate-rule" />
    </div>
  );
}

/** A row of filter controls, matching the FilterBar's 44px triggers. */
export function ToolbarSkeleton({ controls = 3 }: { controls?: number }) {
  const widths = ["w-40", "w-32", "w-32", "w-28", "w-36"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: controls }).map((_, i) => (
        <Skeleton key={i} className={cn("h-11", widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** KPI strip — same 1 → 2 → 4 grid and the same card height as StatCard. */
export function StatStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-lg" />
      ))}
    </div>
  );
}

/**
 * A table. `h-row` is the DataTable's own row token, so the skeleton and the
 * real rows cannot drift — that is the whole reason the token exists.
 */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
      <div className="border-line bg-bg-subtle h-row border-b" />
      <div className="divide-line grid divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex h-row items-center gap-4 px-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="ms-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A stack of cards — the mobile list shape, and several desktop screens. */
export function CardListSkeleton({
  rows = 4,
  height = "h-24",
}: {
  rows?: number;
  height?: string;
}) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn(height, "rounded-lg")} />
      ))}
    </div>
  );
}

/** A settings/edit form: label + input pairs, then room for the save bar. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="grid max-w-lg gap-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="grid gap-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** A bordered panel — charts, boards, anything with a fixed plot area. */
export function PanelSkeleton({ height = "h-80" }: { height?: string }) {
  return <Skeleton className={cn(height, "rounded-lg")} />;
}

/** The settings two-column shell, so /settings/* loads without the nav
 *  jumping in beside the panel a beat later. */
export function SettingsShellSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-12 md:gap-8">
      <div className="md:col-span-3">
        <div className="grid gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid min-w-0 content-start gap-6 md:col-span-9">
        <PageHeaderSkeleton />
        {children ?? <FormSkeleton />}
      </div>
    </div>
  );
}

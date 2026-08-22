"use client";

// StatCard (D1.4) — DESIGN-PRD §6.2.
//
// Label at 13px secondary, value at 32px display and tabular, a delta chip
// with an arrow, an optional sparkline, and the whole card is a link when
// there is a filtered list behind the number.
//
// §7.4 is the rule this component exists to keep: "every KPI clicks through
// to its filtered table — the number and the list must always agree." The
// `href` is not decoration. A KPI you cannot open is a number you cannot
// check, and a number nobody can check is a number nobody trusts.
import * as React from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Amount } from "@/components/ui/amount";
import { Skeleton } from "@/components/ui/skeleton";
import { TONE_CLASSES } from "@/lib/design/status";
import { formatCount } from "@/lib/format";
import { DURATION } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** useLayoutEffect on the client, useEffect on the server — the standard
 *  idiom. Needed so the count-up sets its starting value BEFORE paint; with
 *  a plain useEffect the final figure flashes for a frame first. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export type StatDelta = {
  /** Percentage points, signed. -12.5 renders "12.5%" with a down arrow. */
  percent: number;
  /** What it is measured against — "vs last month". */
  label?: string;
  /**
   * Whether a RISE is good. Spend going up is not a win; reimbursements
   * going up is. Without this the component would have to guess, and it
   * would guess wrong half the time on a finance screen.
   */
  goodDirection?: "up" | "down";
};

export type StatCardProps = {
  label: string;
  /** Integer minor units when `currency` is set; a plain count otherwise. */
  value: number | null | undefined;
  /** Renders the value as money through <Amount>. Omit for counts. */
  currency?: string;
  delta?: StatDelta | null;
  /** Values for the sparkline, oldest first. Fewer than 2 renders nothing. */
  trend?: number[];
  /** Makes the whole card a link to the list behind the number. */
  href?: string;
  /** Extra context under the value — "12 expenses". */
  hint?: string;
  loading?: boolean;
  className?: string;
};

export function StatCard({
  label,
  value,
  currency,
  delta,
  trend,
  href,
  hint,
  loading = false,
  className,
}: StatCardProps) {
  const reducedMotion = useReducedMotion();
  const displayValue = useCountUp(value ?? 0, { enabled: !reducedMotion && !loading });

  const body = (
    <>
      <span className="text-label text-text-secondary">{label}</span>

      {loading ? (
        <Skeleton className="h-8 w-32" />
      ) : currency ? (
        <Amount value={value === null || value === undefined ? null : displayValue} currency={currency} size="display" />
      ) : (
        <span className="tabular text-display text-text-primary">
          {/* Through the shared formatter (D-7), never toLocaleString here:
              a primitive that hard-codes a locale makes every KPI in the
              product Indian-formatted from a line nobody would grep for. */}
          {value === null || value === undefined ? "—" : formatCount(displayValue)}
        </span>
      )}

      {loading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          {delta ? <DeltaChip delta={delta} /> : null}
          {hint ? <span className="text-meta text-text-tertiary">{hint}</span> : null}
        </span>
      )}

      {!loading && trend && trend.length > 1 ? <Sparkline values={trend} /> : null}
    </>
  );

  const shell = cn(
    "border-line bg-bg-surface grid content-start gap-2 rounded-lg border p-5",
    // Flat at rest (§4.2: border or shadow, never both). The link state adds
    // a hover tint rather than a shadow, so the card never appears to lift.
    href &&
      "hover:border-accent-border hover:bg-accent-subtle transition-colors duration-instant ease-out outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
    className
  );

  if (!href || loading) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link href={href} className={shell}>
      {body}
      <span className="sr-only">View the expenses behind this figure</span>
    </Link>
  );
}

/**
 * Delta chip. Colour comes from the status tones, so "good" is the same green
 * as an approved badge rather than a second green invented here.
 *
 * The arrow is what makes it survive greyscale and colour-blindness: direction
 * is carried by shape as well as hue (§5.1, status is never colour alone).
 */
function DeltaChip({ delta }: { delta: StatDelta }) {
  const rising = delta.percent > 0;
  const flat = delta.percent === 0;
  const goodDirection = delta.goodDirection ?? "up";
  const good = flat ? null : rising === (goodDirection === "up");

  const tone =
    good === null
      ? "bg-status-neutral-subtle " + TONE_CLASSES.neutral.text
      : good
        ? "bg-status-success-subtle " + TONE_CLASSES.success.text
        : "bg-status-danger-subtle " + TONE_CLASSES.danger.text;

  const Arrow = rising ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={cn("flex items-center gap-1 rounded-sm px-2 py-1 text-meta tabular", tone)}>
      {flat ? null : <Arrow aria-hidden="true" className="size-3" />}
      {/* The sign lives in the arrow, so the number itself is unsigned —
          "-12.5% ↓" says the same thing twice. */}
      {Math.abs(delta.percent).toFixed(1)}%
      {delta.label ? <span className="text-text-tertiary">{delta.label}</span> : null}
    </span>
  );
}

/**
 * Sparkline. Deliberately unlabelled and unscaled: it shows SHAPE, not
 * values, and adding axes would turn a 24px glyph into a chart that has to
 * be read. Purely decorative, so it is aria-hidden — the numbers a screen
 * reader needs are the value and the delta above it.
 */
function Sparkline({ values }: { values: number[] }) {
  const width = 96;
  const height = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className="text-accent h-6 w-24 overflow-visible"
      fill="none"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Count-up on FIRST MOUNT ONLY (§6.2), 300ms.
 *
 * §6.2 permits up to 400ms; the project's motion law caps everything at 300,
 * and 300 satisfies both — so the ceiling wins and there is no exception to
 * argue about later.
 *
 * It does not re-run when the value changes. A KPI that re-counts every time
 * a filter moves is a number you have to wait for, repeatedly, and the whole
 * point of the dashboard is that the figure is there when you look at it.
 *
 * Reduced motion skips it entirely: the value is correct on the first frame.
 */
function useCountUp(target: number, { enabled }: { enabled: boolean }): number {
  const [display, setDisplay] = React.useState(target);
  const hasRun = React.useRef(false);

  useIsomorphicLayoutEffect(() => {
    if (hasRun.current) {
      // After the first run the value tracks its prop exactly — no animation.
      setDisplay(target);
      return;
    }
    hasRun.current = true;
    if (!enabled || target === 0) {
      setDisplay(target);
      return;
    }

    setDisplay(0);
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION.slow);
      // Same ease-out curve as everything else, approximated for a scalar:
      // fast at the start, settling at the end.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    // Interruptible: unmounting mid-count leaves nothing running.
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return display;
}

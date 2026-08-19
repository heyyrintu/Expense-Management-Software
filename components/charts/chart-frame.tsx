"use client";

// Shared chart chrome (D1.4): the tooltip, the accessible fallback and the
// responsive wrapper every chart uses, so none of them re-decides it.
import * as React from "react";
import { Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ChartPoint = { label: string; value: number };

/**
 * Tooltip styled as a Card (§6.2) with money rendered through <Amount>.
 *
 * Recharts' `formatter` prop can only return a string, which is why the
 * charts previously called formatMoney directly. A CONTENT component has no
 * such limit — it returns React — so the tooltip finally renders the same
 * <Amount> as every table in the product, tabular figures and all.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; dataKey?: string | number; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
  currency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="border-line bg-bg-surface shadow-overlay grid gap-1 rounded-lg border p-3">
      <p className="text-label text-text-primary">{String(label ?? "")}</p>
      <ul className="grid gap-1">
        {payload.map((entry, i) => {
          // Minor units travel on the datum beside the plotted magnitude, so
          // the tooltip formats the untouched integer instead of multiplying
          // a float back up (CLAUDE.md: money never floats).
          const minorKey = entry.dataKey ? `minor:${String(entry.dataKey)}` : "minor";
          const raw = entry.payload?.[minorKey] ?? entry.payload?.minor ?? 0;
          return (
            <li key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: entry.color }}
                />
                <span className="text-meta text-text-secondary">
                  {entry.name ?? "Total"}
                </span>
              </span>
              <Amount value={Number(raw)} currency={currency} size="meta" align="right" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Wraps a chart with its accessible fallback.
 *
 * The SVG carries an aria-label summarising the series, and a toggle reveals
 * the same numbers as a real table. §8 asks for "patterns or direct labels";
 * for a data chart the honest equivalent is the data itself — a sighted user
 * reads the shape, everyone else can read the values, and neither is a
 * second-class path.
 */
export function ChartFrame({
  title,
  summary,
  points,
  currency,
  loading = false,
  empty,
  children,
  className,
}: {
  title: string;
  /** Plain-language description for the aria-label. */
  summary: string;
  /** The same data the chart plots, for the table fallback. */
  points: ChartPoint[];
  currency: string;
  loading?: boolean;
  empty?: { headline: string; description?: string };
  children: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = React.useState(false);

  if (loading) {
    return (
      <div className={cn("grid gap-3", className)}>
        {/* Shape-matched to the chart it replaces: a block the height of the
            plot area plus a row of axis ticks. */}
        <Skeleton className="h-56 w-full rounded-lg" />
        <span className="flex justify-between gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-3 w-8" />
          ))}
        </span>
      </div>
    );
  }

  if (points.length === 0 && empty) {
    return (
      <div className={cn("border-line rounded-lg border", className)}>
        <EmptyState headline={empty.headline} description={empty.description} />
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div role="img" aria-label={summary}>
        {children}
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
        >
          <Table2 aria-hidden="true" className="size-4" />
          {showTable ? "Hide data" : "Show data"}
        </Button>
      </div>

      {showTable ? (
        <div className="border-line overflow-hidden rounded-lg border">
          <table className="w-full text-body">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-bg-subtle text-text-secondary text-label">
              <tr>
                <th scope="col" className="p-3 text-left font-medium">
                  Label
                </th>
                <th scope="col" className="p-3 text-right font-medium">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {points.map((point) => (
                <tr key={point.label}>
                  <td className="text-text-secondary p-3">{point.label}</td>
                  <td className="p-3 text-right">
                    <Amount value={point.value} currency={currency} align="right" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

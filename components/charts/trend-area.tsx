"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "framer-motion";

import {
  animationProps,
  axisProps,
  seriesColor,
} from "@/lib/charts/theme";
import { formatMoney } from "@/lib/money";
import { gridProps } from "@/lib/charts/theme";
import { ChartFrame, ChartTooltipContent } from "./chart-frame";

export function TrendAreaChart({
  series,
  labels,
  currency,
  loading = false,
}: {
  series: Array<Record<string, number | string>>;
  labels: string[];
  currency: string;
  loading?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  // Each series key holds MAJOR units — the stacked area only needs a
  // magnitude. A parallel `minor:<label>` key keeps the untouched integer so
  // the tooltip formats true minor units rather than multiplying a float back
  // up (CLAUDE.md: money never floats).
  const display = series.map((m) => {
    const out: Record<string, number | string> = { month: m.month };
    for (const l of labels) {
      const minor = Number(m[l] ?? 0);
      out[l] = minor / 100;
      out[`minor:${l}`] = minor;
    }
    return out;
  });

  // The fallback table needs one number per period, and a stacked chart's
  // honest single number is the stack total — which is what the reader sees.
  const points = series.map((m) => ({
    label: String(m.month),
    value: labels.reduce((sum, l) => sum + Number(m[l] ?? 0), 0),
  }));

  const summary =
    points.length === 0
      ? "No data"
      : `Stacked spend across ${labels.join(", ")} over ${points.length} periods, ` +
        `totalling ${formatMoney(
          points.reduce((s, p) => s + p.value, 0),
          currency
        )}`;

  return (
    <ChartFrame
      title="Spend over time"
      summary={summary}
      points={points}
      currency={currency}
      loading={loading}
      empty={{ headline: "No spend in this period", description: "Widen the date range to see more." }}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <AreaChart data={display} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis width={70} {...axisProps} />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              content={<ChartTooltipContent currency={currency} />}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12 }}
              // Recharts colours each legend LABEL with its series colour,
              // and wrapperStyle only reaches the container — so the label
              // text inherited sage (3.17:1) and stone (3.72:1) and failed
              // AA for text. The colour cue belongs to the circle icon,
              // which is a graphic and only owes 3:1; the words take the
              // meta ink like every other label in the product.
              formatter={(value) => (
                <span style={{ color: "var(--fg-tertiary)" }}>{value}</span>
              )}
            />
            {labels.map((l, i) => (
              <Area
                key={l}
                type="monotone"
                dataKey={l}
                stackId="1"
                stroke={seriesColor(i)}
                fill={seriesColor(i)}
                fillOpacity={0.5}
                {...animationProps(reducedMotion)}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

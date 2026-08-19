"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "framer-motion";

import {
  CHART_ACCENT,
  animationProps,
  axisProps,
  describeSeries,
  gridProps,
} from "@/lib/charts/theme";
import { formatMoney } from "@/lib/money";
import { ChartFrame, ChartTooltipContent } from "./chart-frame";

export function MonthlyBarChart({
  data,
  currency,
  loading = false,
}: {
  data: Array<{ month: string; total: number }>;
  currency: string;
  loading?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  // `value` is MAJOR units — the bar height only needs a magnitude. `minor`
  // carries the untouched integer so the tooltip formats true minor units
  // instead of multiplying a float back up (CLAUDE.md: money never floats).
  const display = data.map((d) => ({ ...d, value: d.total / 100, minor: d.total }));
  const points = data.map((d) => ({ label: d.month, value: d.total }));

  return (
    <ChartFrame
      title="Monthly spend"
      summary={describeSeries("Monthly spend", points, (v) => formatMoney(v, currency))}
      points={points}
      currency={currency}
      loading={loading}
      empty={{ headline: "No spend in this period", description: "Widen the date range to see more." }}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <BarChart data={display} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis width={70} {...axisProps} />
            <Tooltip
              cursor={{ fill: "var(--bg-subtle)" }}
              content={<ChartTooltipContent currency={currency} />}
            />
            <Bar
              dataKey="value"
              name="Total"
              fill={CHART_ACCENT}
              radius={[4, 4, 0, 0]}
              {...animationProps(reducedMotion)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

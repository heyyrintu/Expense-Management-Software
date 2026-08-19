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
  CHART_SECONDARY,
  animationProps,
  axisProps,
  describeSeries,
  gridProps,
} from "@/lib/charts/theme";
import { formatMoney } from "@/lib/money";
import { ChartFrame, ChartTooltipContent } from "./chart-frame";

export function BreakdownBarChart({
  data,
  currency,
  loading = false,
}: {
  data: Array<{ label: string; total: number }>;
  currency: string;
  loading?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  // `value` is MAJOR units — the bar length only needs a magnitude. `minor`
  // carries the untouched integer so the tooltip formats true minor units
  // instead of multiplying a float back up (CLAUDE.md: money never floats).
  const top = data.slice(0, 8);
  const display = top.map((d) => ({ ...d, value: d.total / 100, minor: d.total }));
  const points = top.map((d) => ({ label: d.label, value: d.total }));

  return (
    <ChartFrame
      title="Spend by category"
      summary={describeSeries("Spend by category", points, (v) => formatMoney(v, currency))}
      points={points}
      currency={currency}
      loading={loading}
      empty={{ headline: "Nothing to break down yet", description: "Categories appear once expenses are captured." }}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <BarChart
            data={display}
            layout="vertical"
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            {/* Horizontal layout, so the rules run the other way — but still
                only along the value axis, never across the categories. */}
            <CartesianGrid {...gridProps} vertical horizontal={false} />
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey="label" width={110} {...axisProps} />
            <Tooltip
              cursor={{ fill: "var(--bg-subtle)" }}
              content={<ChartTooltipContent currency={currency} />}
            />
            <Bar
              dataKey="value"
              name="Total"
              fill={CHART_SECONDARY}
              radius={[0, 4, 4, 0]}
              {...animationProps(reducedMotion)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

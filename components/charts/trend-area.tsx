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
import { CHART_SERIES } from "@/lib/design/chart-colors";

// Palette lives in lib/design/chart-colors so every chart shares one list.
const COLORS = CHART_SERIES;

export function TrendAreaChart({
  series,
  labels,
  currency,
}: {
  series: Array<Record<string, number | string>>;
  labels: string[];
  currency: string;
}) {
  const display = series.map((m) => {
    const out: Record<string, number | string> = { month: m.month };
    for (const l of labels) out[l] = Number(m[l] ?? 0) / 100;
    return out;
  });
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={display} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            formatter={(value, name) => [
              new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(value)),
              String(name),
            ]}
          />
          <Legend />
          {labels.map((l, i) => (
            <Area
              key={l}
              type="monotone"
              dataKey={l}
              stackId="1"
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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
import { formatMoney } from "@/lib/money";

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
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={display} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            // Recharts formatters must return a string, so <Amount> can't be
            // used here — formatMoney keeps the formatting in lib/money.ts.
            formatter={(_value, name, item) => [
              formatMoney(Number(item?.payload?.[`minor:${String(name)}`] ?? 0), currency),
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

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
import { CHART_PRIMARY } from "@/lib/design/chart-colors";
import { formatMoney } from "@/lib/money";

export function MonthlyBarChart({
  data,
  currency,
}: {
  data: Array<{ month: string; total: number }>;
  currency: string;
}) {
  // `value` is MAJOR units — the bar height only needs a magnitude. `minor`
  // carries the untouched integer so the tooltip can format true minor units
  // instead of multiplying a float back up (CLAUDE.md: money never floats).
  const display = data.map((d) => ({ ...d, value: d.total / 100, minor: d.total }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={display} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={70} />
          <Tooltip
            // Recharts formatters must return a string, so <Amount> can't be
            // used here — formatMoney keeps the formatting in lib/money.ts.
            formatter={(_value, _name, item) => [
              formatMoney(Number(item?.payload?.minor ?? 0), currency),
              "Total",
            ]}
          />
          <Bar dataKey="value" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

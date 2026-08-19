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

export function MonthlyBarChart({
  data,
  currency,
}: {
  data: Array<{ month: string; total: number }>;
  currency: string;
}) {
  const display = data.map((d) => ({ ...d, value: d.total / 100 }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={display} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={70} />
          <Tooltip
            formatter={(value) => [
              new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency,
              }).format(Number(value)),
              "Total",
            ]}
          />
          <Bar dataKey="value" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

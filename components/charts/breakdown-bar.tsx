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

export function BreakdownBarChart({
  data,
  currency,
}: {
  data: Array<{ label: string; total: number }>;
  currency: string;
}) {
  const display = data.slice(0, 8).map((d) => ({ ...d, value: d.total / 100 }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart
          data={display}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => [
              new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency,
              }).format(Number(value)),
              "Total",
            ]}
          />
          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

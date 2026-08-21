"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SalesTrendPoint, TrendGranularity } from "@hpl/shared";
import { formatCurrency } from "@/lib/format";

function formatLabel(dateIso: string, granularity: TrendGranularity): string {
  const date = new Date(dateIso);
  if (granularity === "monthly") return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function RevenueTrendChart({ data, granularity }: { data: SalesTrendPoint[]; granularity: TrendGranularity }) {
  const formatted = data.map((d) => ({ ...d, label: formatLabel(d.date, granularity) }));
  const hasTarget = formatted.some((d) => d.target !== null);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v)}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          formatter={(value: number, name: string) => [formatCurrency(value), name === "revenue" ? "Actual Revenue" : "Target"]}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          name="revenue"
          isAnimationActive={false}
        />
        {hasTarget && (
          <Line
            type="monotone"
            dataKey="target"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            name="target"
            connectNulls
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

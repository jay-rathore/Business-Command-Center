"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp, Zap } from "lucide-react";
import { TrafficOverview, TrafficTimelineEvent } from "@hpl/shared";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatLabel(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

interface AnomalyDotProps {
  key?: string;
  cx?: number;
  cy?: number;
  payload?: TrafficOverview["series"][number];
  onSelectEvent: (id: string) => void;
}

function AnomalyDot({ cx, cy, payload, onSelectEvent }: AnomalyDotProps) {
  if (!payload?.isAnomaly || cx == null || cy == null) return null;
  const color = payload.anomalyDirection === "up" ? "var(--good)" : "var(--critical)";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      stroke="var(--surface)"
      strokeWidth={2}
      className="cursor-pointer"
      onClick={() => onSelectEvent(`anomaly:${payload.date}`)}
    >
      <title>{`Traffic ${payload.anomalyDirection === "up" ? "spike" : "drop"} on ${payload.date} — click for AI analysis`}</title>
    </circle>
  );
}

export function TrafficTimelineChart({
  series,
  events,
  onSelectEvent,
}: {
  series: TrafficOverview["series"];
  events: TrafficTimelineEvent[];
  onSelectEvent: (id: string) => void;
}) {
  const chartData = series.map((d) => ({ ...d, label: formatLabel(d.date) }));

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis tickFormatter={(v: number) => formatNumber(v)} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(value: number) => [formatNumber(value), "Visitors"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="visitors"
            stroke="var(--accent)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={({ key, ...props }: AnomalyDotProps) => <AnomalyDot key={key} {...props} onSelectEvent={onSelectEvent} />}
          />
        </LineChart>
      </ResponsiveContainer>

      {events.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => onSelectEvent(event.id)}
              className="flex items-center gap-2.5 rounded-sm px-1.5 py-1 text-left text-xs text-text-secondary transition-colors hover:bg-surface-hover"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  event.type === "TRAFFIC_ANOMALY" ? "bg-accent-tint text-accent-strong" : "bg-surface-2 text-text-muted",
                )}
              >
                {event.type === "TRAFFIC_ANOMALY" ? (
                  event.label.includes("spike") ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )
                ) : (
                  <Zap className="h-3 w-3" />
                )}
              </span>
              <span className="font-medium text-text-muted">{formatLabel(event.occurredAt)}</span>
              <span className="truncate">{event.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Activity, MousePointerClick, Repeat, Users, Zap } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrafficOverview, useTrafficTimeline } from "@/lib/query/useTrafficIntelligence";
import { useDateRangeParams } from "@/hooks/useDateRangeParams";
import { formatNumber, formatPercent } from "@/lib/format";
import { TrafficTimelineChart } from "./TrafficTimelineChart";
import { EventDetailDialog } from "./EventDetailDialog";
import { TrafficAiQueryPanel } from "./TrafficAiQueryPanel";
import { ProactiveInsightsFeed } from "./ProactiveInsightsFeed";

function deltaLabel(pct: number | null): string | undefined {
  if (pct == null) return undefined;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

export function TrafficIntelligencePanel() {
  const { dateFrom, dateTo } = useDateRangeParams();
  const overviewQuery = useTrafficOverview({ dateFrom, dateTo });
  const timelineQuery = useTrafficTimeline({ dateFrom, dateTo });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const overview = overviewQuery.data;
  const hasData = (overview?.series.length ?? 0) > 0;

  const totalNew = overview?.series.reduce((sum, d) => sum + d.newVisitors, 0) ?? 0;
  const totalReturning = overview?.series.reduce((sum, d) => sum + d.returningVisitors, 0) ?? 0;
  const newShare = totalNew + totalReturning > 0 ? (totalNew / (totalNew + totalReturning)) * 100 : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-sm font-semibold text-text-primary">Traffic Intelligence</h2>
        <p className="text-xs text-text-muted">
          Auto-flagged traffic anomalies, campaign events, and AI root-cause analysis
          {dateFrom || dateTo ? " for the selected range." : " for the last 30 days."}
        </p>
      </div>

      <ProactiveInsightsFeed />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Visitors"
          value={overview ? formatNumber(overview.totals.visitors) : "—"}
          icon={Users}
          delta={deltaLabel(overview?.deltas.dayOverDay ?? null)}
          deltaTone={overview && (overview.deltas.dayOverDay ?? 0) < 0 ? "critical" : "good"}
          sub="vs yesterday"
        />
        <KpiCard
          label="Sessions"
          value={overview ? formatNumber(overview.totals.sessions) : "—"}
          icon={Activity}
          delta={deltaLabel(overview?.deltas.weekOverWeek ?? null)}
          deltaTone={overview && (overview.deltas.weekOverWeek ?? 0) < 0 ? "critical" : "good"}
          sub="vs last week"
        />
        <KpiCard label="Page Views" value={overview ? formatNumber(overview.totals.pageViews) : "—"} icon={MousePointerClick} />
        <KpiCard label="Conversions" value={overview ? formatNumber(overview.totals.conversions) : "—"} icon={Zap} />
        <KpiCard
          label="Conversion Rate"
          value={overview?.totals.conversionRate != null ? formatPercent(overview.totals.conversionRate) : "—"}
          icon={Zap}
        />
        <KpiCard label="New Visitors" value={newShare != null ? formatPercent(newShare) : "—"} icon={Repeat} sub="of total" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Traffic Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {hasData && overview ? (
            <TrafficTimelineChart series={overview.series} events={timelineQuery.data ?? []} onSelectEvent={setSelectedEventId} />
          ) : (
            <EmptyState icon={Activity} title="No traffic data yet" description="The timeline will appear once website analytics data is available." />
          )}
        </CardContent>
      </Card>

      <TrafficAiQueryPanel />

      <EventDetailDialog eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </div>
  );
}

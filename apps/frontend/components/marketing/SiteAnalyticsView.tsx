"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MousePointerClick, Search, Users, Zap } from "lucide-react";
import { SearchConsoleSummary, SiteAnalyticsSummary } from "@hpl/shared";
import { useSearchConsole, useSiteAnalytics } from "@/lib/query/useSiteAnalytics";
import { KpiCard } from "@/components/shared/KpiCard";
import { RankedBarList } from "@/components/shared/RankedBarList";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatNumber, formatPercent } from "@/lib/format";

function formatLabel(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const METRIC_INFO = {
  sessions: {
    title: "Sessions",
    description:
      "Total visits to your website over the last 30 days, as tracked by Google Analytics (GA4). One visitor can generate multiple sessions if they leave and come back after a period of inactivity.",
  },
  activeUsers: {
    title: "Active Users",
    description:
      "Number of distinct visitors GA4 recorded on your website over the last 30 days. Summed day-by-day, so a visitor active on more than one day is counted once per day, not once overall.",
  },
  conversions: {
    title: "Conversions",
    description:
      "Total count of GA4 conversion events (form submissions, key clicks, or whichever events are marked as conversions in your GA4 property) over the last 30 days.",
  },
  searchClicks: {
    title: "Search Clicks",
    description:
      "Number of times people clicked through to your website from Google Search results over the last 30 days, as reported by Search Console.",
  },
  impressions: {
    title: "Impressions",
    description:
      "Number of times your website appeared in Google Search results — clicked or not — over the last 30 days, as reported by Search Console.",
  },
  avgPosition: {
    title: "Avg Position",
    description:
      "Average ranking position of your website in Google Search results for the queries it appeared in, over the last 30 days. Lower is better (1 = top result). CTR is total clicks ÷ total impressions over the same period.",
  },
} as const;

type MetricKey = keyof typeof METRIC_INFO;

export function SiteAnalyticsView({
  initialSiteAnalytics,
  initialSearchConsole,
}: {
  initialSiteAnalytics: SiteAnalyticsSummary | null;
  initialSearchConsole: SearchConsoleSummary | null;
}) {
  const siteAnalyticsQuery = useSiteAnalytics(initialSiteAnalytics ?? undefined);
  const searchConsoleQuery = useSearchConsole(initialSearchConsole ?? undefined);
  const [openMetric, setOpenMetric] = useState<MetricKey | null>(null);

  const site = siteAnalyticsQuery.data;
  const search = searchConsoleQuery.data;
  const hasSiteData = (site?.series.length ?? 0) > 0;
  const hasSearchData = (search?.series.length ?? 0) > 0;

  const chartData = (site?.series ?? []).map((d) => ({ ...d, label: formatLabel(d.date) }));
  const activeMetric = openMetric ? METRIC_INFO[openMetric] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-sm font-semibold text-text-primary">Website & Search (last 30 days)</h2>
        <p className="text-xs text-text-muted">
          GA4 site traffic and Search Console query performance for the trailing 30 days. Click a metric for details
          on what it measures.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Sessions"
          value={site ? formatNumber(site.totals.sessions) : "—"}
          icon={Users}
          onClick={() => setOpenMetric("sessions")}
        />
        <KpiCard
          label="Active Users"
          value={site ? formatNumber(site.totals.activeUsers) : "—"}
          icon={Users}
          onClick={() => setOpenMetric("activeUsers")}
        />
        <KpiCard
          label="Conversions"
          value={site ? formatNumber(site.totals.conversions) : "—"}
          icon={Zap}
          onClick={() => setOpenMetric("conversions")}
        />
        <KpiCard
          label="Search Clicks"
          value={search ? formatNumber(search.totals.clicks) : "—"}
          icon={MousePointerClick}
          onClick={() => setOpenMetric("searchClicks")}
        />
        <KpiCard
          label="Impressions"
          value={search ? formatNumber(search.totals.impressions) : "—"}
          icon={Search}
          onClick={() => setOpenMetric("impressions")}
        />
        <KpiCard
          label="Avg Position"
          value={search && hasSearchData ? search.totals.position.toFixed(1) : "—"}
          sub={search && hasSearchData ? `CTR ${formatPercent(search.totals.ctr * 100)}` : undefined}
          icon={Search}
          onClick={() => setOpenMetric("avgPosition")}
        />
      </div>

      <Dialog open={openMetric !== null} onOpenChange={(open) => !open && setOpenMetric(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeMetric?.title}</DialogTitle>
            <DialogDescription>{activeMetric?.description}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Sessions Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {hasSiteData ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis
                  tickFormatter={(v: number) => formatNumber(v)}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(value: number) => [formatNumber(value), "Sessions"]}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="sessions" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Users} title="No GA4 data yet" description="Sessions will appear once GA4 sync is configured." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Search Queries</CardTitle>
        </CardHeader>
        <CardContent>
          {hasSearchData && search ? (
            <RankedBarList
              entries={search.topQueries.map((q) => ({
                label: q.query,
                value: q.clicks,
                displayValue: `${formatNumber(q.clicks)} clicks · ${formatPercent(q.ctr * 100)} CTR`,
              }))}
            />
          ) : (
            <EmptyState icon={Search} title="No Search Console data yet" description="Top queries will appear once Search Console sync is configured." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

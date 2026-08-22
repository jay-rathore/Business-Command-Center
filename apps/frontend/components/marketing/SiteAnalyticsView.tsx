"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MousePointerClick, Search, Users, Zap } from "lucide-react";
import { SearchConsoleSummary, SiteAnalyticsSummary } from "@hpl/shared";
import { useSearchConsole, useSiteAnalytics } from "@/lib/query/useSiteAnalytics";
import { KpiCard } from "@/components/shared/KpiCard";
import { RankedBarList } from "@/components/shared/RankedBarList";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";

function formatLabel(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function SiteAnalyticsView({
  initialSiteAnalytics,
  initialSearchConsole,
}: {
  initialSiteAnalytics: SiteAnalyticsSummary | null;
  initialSearchConsole: SearchConsoleSummary | null;
}) {
  const siteAnalyticsQuery = useSiteAnalytics(initialSiteAnalytics ?? undefined);
  const searchConsoleQuery = useSearchConsole(initialSearchConsole ?? undefined);

  const site = siteAnalyticsQuery.data;
  const search = searchConsoleQuery.data;
  const hasSiteData = (site?.series.length ?? 0) > 0;
  const hasSearchData = (search?.series.length ?? 0) > 0;

  const chartData = (site?.series ?? []).map((d) => ({ ...d, label: formatLabel(d.date) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-sm font-semibold text-text-primary">Website & Search (last 30 days)</h2>
        <p className="text-xs text-text-muted">
          GA4 site traffic and Search Console query performance — awaiting credentials, this section shows an empty
          state until GOOGLE_SERVICE_ACCOUNT_EMAIL / GA4_PROPERTY_ID / SEARCH_CONSOLE_SITE_URL are configured.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Sessions" value={site ? formatNumber(site.totals.sessions) : "—"} icon={Users} />
        <KpiCard label="Active Users" value={site ? formatNumber(site.totals.activeUsers) : "—"} icon={Users} />
        <KpiCard label="Conversions" value={site ? formatNumber(site.totals.conversions) : "—"} icon={Zap} />
        <KpiCard label="Search Clicks" value={search ? formatNumber(search.totals.clicks) : "—"} icon={MousePointerClick} />
        <KpiCard label="Impressions" value={search ? formatNumber(search.totals.impressions) : "—"} icon={Search} />
        <KpiCard
          label="Avg Position"
          value={search && hasSearchData ? search.totals.position.toFixed(1) : "—"}
          sub={search && hasSearchData ? `CTR ${formatPercent(search.totals.ctr * 100)}` : undefined}
          icon={Search}
        />
      </div>

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

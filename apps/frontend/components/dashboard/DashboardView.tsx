"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IndianRupee, ShoppingCart, TrendingUp, Users } from "lucide-react";
import {
  AiExecutiveSummary,
  AttentionItem,
  BusinessHealthSignal,
  ContributorTab,
  DashboardSummary,
} from "@hpl/shared";
import { useAiSummary, useAttentionFeed, useBusinessHealth, useContributors, useDashboardSummary } from "@/lib/query/useDashboard";
import { useSalesRevenueTrend } from "@/lib/query/useSales";
import { KpiCard } from "@/components/shared/KpiCard";
import { RevenueTrendChart } from "@/components/shared/RevenueTrendChart";
import { AttentionFeed } from "@/components/shared/AttentionFeed";
import { RankedBarList } from "@/components/shared/RankedBarList";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { TargetRing } from "./TargetRing";
import { HealthSignalList } from "./HealthSignalList";
import { AiSummaryCard } from "./AiSummaryCard";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const CONTRIBUTOR_TABS: { key: ContributorTab; label: string }[] = [
  { key: "dealers", label: "Dealers" },
  { key: "products", label: "Products" },
  { key: "states", label: "States" },
  { key: "executives", label: "Executives" },
  { key: "projects", label: "Projects" },
];

export function DashboardView({
  initialSummary,
  initialHealth,
  initialAttention,
  initialAiSummary,
}: {
  initialSummary: DashboardSummary | null;
  initialHealth: BusinessHealthSignal[] | null;
  initialAttention: AttentionItem[] | null;
  initialAiSummary: AiExecutiveSummary | null;
}) {
  const router = useRouter();
  const [contributorTab, setContributorTab] = useState<ContributorTab>("dealers");

  const summaryQuery = useDashboardSummary(initialSummary ?? undefined);
  const trendQuery = useSalesRevenueTrend("monthly");
  const healthQuery = useBusinessHealth(initialHealth ?? undefined);
  const attentionQuery = useAttentionFeed(initialAttention ?? undefined);
  const contributorsQuery = useContributors(contributorTab);
  const aiSummaryQuery = useAiSummary(initialAiSummary ?? undefined);

  const s = summaryQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">Command Center</h1>
          <p className="text-sm text-text-muted">Here&apos;s the health of your business, at a glance</p>
        </div>
        <LastUpdated
          timestamp={summaryQuery.dataUpdatedAt}
          isRefreshing={summaryQuery.isFetching}
          onRefresh={() => {
            summaryQuery.refetch();
            trendQuery.refetch();
            healthQuery.refetch();
            attentionQuery.refetch();
            contributorsQuery.refetch();
            aiSummaryQuery.refetch();
          }}
        />
      </div>

      {/* Hero: Revenue + Target Achievement */}
      <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-linear-to-br from-accent-tint to-surface p-6 md:grid-cols-2">
        <div className="flex flex-col justify-center gap-2">
          <span className="text-xs font-medium text-text-muted">Revenue this month</span>
          <span className="font-display text-4xl font-semibold text-text-primary">{s ? formatCurrency(s.revenue.value) : "—"}</span>
          {s?.revenue.delta != null && (
            <span className={cn("text-sm font-medium", s.revenue.delta >= 0 ? "text-good" : "text-critical")}>
              {formatPercent(s.revenue.delta, { signed: true })} vs previous month
            </span>
          )}
        </div>
        <div className="flex items-center justify-center gap-4 md:justify-end">
          <TargetRing percent={s?.targetAchievement.value ?? 0} />
          <div>
            <span className="block text-xs text-text-muted">Target Achievement</span>
            <span className="block text-sm font-medium text-text-primary">{s ? formatPercent(s.targetAchievement.value) : "—"}</span>
          </div>
        </div>
      </div>

      {/* Secondary KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Orders" value={s ? formatNumber(s.orders.value) : "—"} icon={ShoppingCart} />
        <KpiCard label="Pipeline Value" value={s ? formatCurrency(s.pipelineValue.value) : "—"} icon={IndianRupee} />
        <KpiCard label="New Leads" value={s ? formatNumber(s.newLeads.value) : "—"} icon={Users} />
        <KpiCard label="Conversion Rate" value={s ? formatPercent(s.conversionRate.value) : "—"} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {trendQuery.data && trendQuery.data.length > 0 ? (
              <RevenueTrendChart data={trendQuery.data} granularity="monthly" />
            ) : (
              <EmptyState title="No trend data yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Health</CardTitle>
          </CardHeader>
          <CardContent>
            {healthQuery.data ? <HealthSignalList signals={healthQuery.data} /> : <EmptyState title="Loading…" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs Your Attention</CardTitle>
          </CardHeader>
          <CardContent>
            {attentionQuery.data && attentionQuery.data.length > 0 ? (
              <AttentionFeed
                items={attentionQuery.data.map((a) => ({
                  id: a.id,
                  title: a.title,
                  meta: a.value != null ? `${a.meta} · ${formatCurrency(a.value)}` : a.meta,
                  value: "",
                  priority: a.priority,
                }))}
                onItemClick={(id) => {
                  const item = attentionQuery.data?.find((i) => i.id === id);
                  if (item) router.push(`/${item.module.toLowerCase()}`);
                }}
              />
            ) : (
              <EmptyState title="Nothing needs attention right now" description="You're all caught up." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Business Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-1 rounded-sm border border-border p-0.5" style={{ width: "fit-content" }}>
              {CONTRIBUTOR_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setContributorTab(tab.key)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    contributorTab === tab.key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {contributorsQuery.data && contributorsQuery.data.length > 0 ? (
              <RankedBarList
                entries={contributorsQuery.data.map((c) => ({ label: c.name, value: c.value, displayValue: formatCurrency(c.value) }))}
              />
            ) : (
              <EmptyState title="No data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      {aiSummaryQuery.data && <AiSummaryCard summary={aiSummaryQuery.data} />}
    </div>
  );
}

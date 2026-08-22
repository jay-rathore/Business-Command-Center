"use client";

import { useState } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { IndianRupee, Layers, Megaphone, TrendingUp, Users } from "lucide-react";
import { CampaignListItem, CampaignPlatform, ChannelBreakdownEntry, MarketingKpis, PaginatedResponse } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useChannelBreakdown, useMarketingKpis, useMarketingList } from "@/lib/query/useMarketing";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { RankedBarList } from "@/components/shared/RankedBarList";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignPlatformBadge } from "./CampaignPlatformBadge";
import { CampaignStatusBadge } from "./CampaignStatusBadge";
import { CampaignSourceBadge } from "./CampaignSourceBadge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";

const PLATFORM_LABEL: Record<CampaignPlatform, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  ORGANIC: "Organic",
  OTHER: "Other",
};

const PLATFORM_FILTERS: { key: CampaignPlatform | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "META_ADS", label: "Meta Ads" },
  { key: "GOOGLE_ADS", label: "Google Ads" },
  { key: "WEBSITE", label: "Website" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "ORGANIC", label: "Organic" },
  { key: "OTHER", label: "Other" },
];

export function MarketingView({
  initialKpis,
  initialList,
  initialBreakdown,
}: {
  initialKpis: MarketingKpis | null;
  initialList: PaginatedResponse<CampaignListItem> | null;
  initialBreakdown: ChannelBreakdownEntry[] | null;
}) {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10 });
  const [platformFilter, setPlatformFilter] = useState<CampaignPlatform | undefined>(undefined);
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);

  const kpisQuery = useMarketingKpis(initialKpis ?? undefined);
  const breakdownQuery = useChannelBreakdown(initialBreakdown ?? undefined);
  const listQuery = useMarketingList({ ...state, q: debouncedQuery, platform: platformFilter }, initialList ?? undefined);

  const kpis = kpisQuery.data;
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<CampaignListItem, any>[] = [
    { accessorKey: "name", header: "Campaign" },
    { accessorKey: "platform", header: "Platform", enableSorting: false, cell: (c) => <CampaignPlatformBadge platform={c.getValue()} /> },
    { accessorKey: "status", header: "Status", enableSorting: false, cell: (c) => <CampaignStatusBadge status={c.getValue()} /> },
    { accessorKey: "spend", header: "Spend", cell: (c) => formatCurrency(c.getValue()) },
    { accessorKey: "leadsCount", header: "Leads", cell: (c) => formatNumber(c.getValue()) },
    {
      id: "cpl",
      header: "CPL",
      cell: (c) => {
        const v = c.row.original.cpl;
        return v != null ? formatCurrency(v) : "—";
      },
    },
    {
      id: "roas",
      header: "ROAS",
      cell: (c) => {
        const v = c.row.original.roas;
        return v != null ? `${v.toFixed(2)}x` : "—";
      },
    },
    { accessorKey: "source", header: "Source", enableSorting: false, cell: (c) => <CampaignSourceBadge source={c.getValue()} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Marketing</h1>
        <p className="text-sm text-text-muted">Spend, CPL and ROAS across every acquisition channel</p>
        <p className="mt-1 text-xs text-text-muted">
          Meta Ads and Google Ads are live data synced from your ad accounts. Website, WhatsApp, Organic and Other
          are placeholder figures pending those integrations — look for the Live/Demo badge on each row.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Total Spend" value={kpis ? formatCurrency(kpis.totalSpend) : "—"} icon={IndianRupee} />
        <KpiCard label="Total Leads" value={kpis ? formatNumber(kpis.totalLeads) : "—"} icon={Users} />
        <KpiCard label="Blended CPL" value={kpis?.blendedCpl != null ? formatCurrency(kpis.blendedCpl) : "—"} icon={Layers} />
        <KpiCard label="Active Campaigns" value={kpis ? formatNumber(kpis.activeCampaigns) : "—"} icon={Megaphone} />
        <KpiCard
          label="Blended ROAS"
          value={kpis?.blendedRoas != null ? `${kpis.blendedRoas.toFixed(2)}x` : "—"}
          icon={TrendingUp}
          sub="Paid demo channels only — excludes Meta and zero-spend channels"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By Channel</CardTitle>
        </CardHeader>
        <CardContent>
          {breakdownQuery.data && breakdownQuery.data.some((b) => b.campaignCount > 0) ? (
            <RankedBarList
              entries={breakdownQuery.data
                .filter((b) => b.campaignCount > 0)
                .map((b) => ({
                  label: `${PLATFORM_LABEL[b.platform]} · ${b.campaignCount} campaigns`,
                  value: b.spend,
                  displayValue: `${formatCurrency(b.spend)} · ${formatNumber(b.leadsCount)} leads`,
                }))}
            />
          ) : (
            <EmptyState icon={Megaphone} title="No campaigns yet" />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-text-primary">All Campaigns</h2>
          <div className="flex flex-wrap gap-1 rounded-sm border border-border p-0.5">
            {PLATFORM_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setPlatformFilter(f.key === "ALL" ? undefined : (f.key as CampaignPlatform));
                  setPage(1);
                }}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  (platformFilter ?? "ALL") === f.key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={listQuery.data?.data ?? []}
          meta={listQuery.data?.meta ?? { page: 1, pageSize: state.pageSize, total: 0, totalPages: 1 }}
          page={state.page}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={(updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater;
            if (next[0]) setSort(next[0].id);
          }}
          query={state.q}
          onQueryChange={setQuery}
          onRowClick={(row) => openDrawer("campaign", row)}
          searchPlaceholder="Search campaign name…"
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No campaigns match your search."
        />
      </div>
    </div>
  );
}

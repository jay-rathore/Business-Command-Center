"use client";

import { useState } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { Activity, IndianRupee, ShieldAlert, Store, TrendingUp, UserCheck, UserPlus, UserX } from "lucide-react";
import { DealerListItem, DealersKpis, DealerStatus, PaginatedResponse } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useDateRangeParams } from "@/hooks/useDateRangeParams";
import {
  useDealersKpis,
  useDealersLeaderboard,
  useDealersList,
  useDealersRiskAlerts,
} from "@/lib/query/useDealers";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { AttentionFeed } from "@/components/shared/AttentionFeed";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealerStatusBadge } from "./DealerStatusBadge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const STATUS_FILTERS: { key: DealerStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "NEW", label: "New" },
  { key: "AT_RISK", label: "At Risk" },
  { key: "INACTIVE", label: "Inactive" },
];

export function DealersView({
  initialKpis,
  initialList,
}: {
  initialKpis: DealersKpis | null;
  initialList: PaginatedResponse<DealerListItem> | null;
}) {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10 });
  const [statusFilter, setStatusFilter] = useState<DealerStatus | undefined>(undefined);
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);
  const { dateFrom, dateTo } = useDateRangeParams();
  const range = { dateFrom, dateTo };

  const kpisQuery = useDealersKpis(range, initialKpis ?? undefined);
  const leaderboardQuery = useDealersLeaderboard(range);
  const riskAlertsQuery = useDealersRiskAlerts(range);
  const listQuery = useDealersList({ ...state, q: debouncedQuery, status: statusFilter, ...range }, initialList ?? undefined);

  const kpis = kpisQuery.data;
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<DealerListItem, any>[] = [
    { accessorKey: "name", header: "Dealer" },
    { accessorKey: "state", header: "Location", enableSorting: false, cell: (c) => `${c.row.original.city}, ${c.row.original.state}` },
    { accessorKey: "managerName", header: "Manager", enableSorting: false, cell: (c) => c.getValue() ?? "Unassigned" },
    { accessorKey: "totalOrders", header: "Orders", cell: (c) => formatNumber(c.getValue()) },
    { accessorKey: "revenue", header: "Revenue", cell: (c) => formatCurrency(c.getValue()) },
    {
      accessorKey: "healthScore",
      header: "Health",
      cell: (c) => {
        const v = c.getValue<number | null>();
        return v === null ? "—" : <span className={v >= 70 ? "text-good" : v >= 40 ? "text-warning" : "text-critical"}>{v}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: false,
      cell: (c) => <DealerStatusBadge status={c.getValue()} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Dealers</h1>
        <p className="text-sm text-text-muted">Dealer network health, performance and risk</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        <KpiCard label="Total Dealers" value={kpis ? formatNumber(kpis.totalDealers) : "—"} icon={Store} />
        <KpiCard label="Active Dealers" value={kpis ? formatNumber(kpis.activeDealers) : "—"} icon={UserCheck} />
        <KpiCard label="New Dealers" value={kpis ? formatNumber(kpis.newDealers) : "—"} icon={UserPlus} />
        <KpiCard label="At-Risk Dealers" value={kpis ? formatNumber(kpis.atRiskDealers) : "—"} icon={ShieldAlert} />
        <KpiCard label="Inactive Dealers" value={kpis ? formatNumber(kpis.inactiveDealers) : "—"} icon={UserX} />
        <KpiCard label="Network Revenue" value={kpis ? formatCurrency(kpis.networkRevenue) : "—"} icon={IndianRupee} />
        <KpiCard label="Avg Health Score" value={kpis?.avgHealthScore != null ? String(kpis.avgHealthScore) : "—"} icon={Activity} />
        <KpiCard
          label="Order Growth"
          value={kpis ? formatPercent(kpis.orderGrowth, { signed: true }) : "—"}
          icon={TrendingUp}
          deltaTone={kpis?.orderGrowth == null ? "neutral" : kpis.orderGrowth >= 0 ? "good" : "critical"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Dealers</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardQuery.data && leaderboardQuery.data.length > 0 ? (
              <Leaderboard
                entries={leaderboardQuery.data.map((d, i) => ({
                  id: d.id,
                  rank: i + 1,
                  name: d.name,
                  primaryValue: formatCurrency(d.revenue),
                  secondaryLabel: `${d.healthScore ?? "—"} health · ${formatNumber(d.totalOrders)} orders`,
                }))}
                onEntryClick={(id) => {
                  const dealer = listQuery.data?.data.find((d) => d.id === id);
                  if (dealer) openDrawer("dealer", dealer);
                }}
              />
            ) : (
              <EmptyState icon={Store} title="No dealers yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dealer Risk Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {riskAlertsQuery.data && riskAlertsQuery.data.length > 0 ? (
              <AttentionFeed
                items={riskAlertsQuery.data.map((d) => ({
                  id: d.id,
                  title: d.name,
                  meta: `${d.city}, ${d.state} · ${d.managerName ?? "Unassigned"}`,
                  value: `${d.healthScore ?? "—"}`,
                  priority: d.status === "INACTIVE" ? "critical" : "high",
                }))}
                onItemClick={(id) => {
                  const dealer = riskAlertsQuery.data?.find((d) => d.id === id);
                  if (dealer) openDrawer("dealer", dealer);
                }}
              />
            ) : (
              <EmptyState icon={ShieldAlert} title="No dealers at risk" description="At-risk and inactive dealers will show up here." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-text-primary">All Dealers</h2>
          <div className="flex gap-1 rounded-sm border border-border p-0.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setStatusFilter(f.key === "ALL" ? undefined : (f.key as DealerStatus));
                  setPage(1);
                }}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  (statusFilter ?? "ALL") === f.key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
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
          onRowClick={(row) => openDrawer("dealer", row)}
          searchPlaceholder="Search dealer name, code or city…"
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No dealers match your search."
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { IndianRupee, ShoppingCart, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { BreakdownDimension, SalesOverview, SalesTableRow, SalesTrendPoint, TrendGranularity } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useSalesBreakdown, useSalesOverview, useSalesRevenueTrend, useSalesTable } from "@/lib/query/useSales";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { RankedBarList } from "@/components/shared/RankedBarList";
import { RevenueTrendChart } from "@/components/shared/RevenueTrendChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const BREAKDOWN_TABS: { key: BreakdownDimension; label: string }[] = [
  { key: "product", label: "Product" },
  { key: "state", label: "State" },
  { key: "dealer", label: "Dealer" },
  { key: "executive", label: "Sales Executive" },
  { key: "customer", label: "Customer" },
];

const GRANULARITIES: { key: TrendGranularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export function SalesView({
  initialOverview,
  initialTrend,
}: {
  initialOverview: SalesOverview | null;
  initialTrend: SalesTrendPoint[] | null;
}) {
  const [granularity, setGranularity] = useState<TrendGranularity>("monthly");
  const [breakdownTab, setBreakdownTab] = useState<BreakdownDimension>("product");
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10, sortBy: "revenue" });
  const debouncedQuery = useDebounce(state.q);

  const overviewQuery = useSalesOverview(initialOverview ?? undefined);
  const trendQuery = useSalesRevenueTrend(granularity, initialTrend ?? undefined);
  const breakdownQuery = useSalesBreakdown(breakdownTab);
  const tableQuery = useSalesTable({ ...state, q: debouncedQuery });

  const overview = overviewQuery.data;
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<SalesTableRow, any>[] = [
    { accessorKey: "sku", header: "Product" },
    { accessorKey: "categoryName", header: "Category", enableSorting: false },
    { accessorKey: "units", header: "Units", cell: (c) => formatNumber(c.getValue()) },
    { accessorKey: "orders", header: "Orders", cell: (c) => formatNumber(c.getValue()) },
    { accessorKey: "revenue", header: "Revenue", cell: (c) => formatCurrency(c.getValue()) },
    {
      accessorKey: "growth",
      header: "Growth",
      cell: (c) => {
        const v = c.getValue<number | null>();
        return (
          <span className={v === null ? "text-text-muted" : v >= 0 ? "text-good" : "text-critical"}>
            {formatPercent(v, { signed: true })}
          </span>
        );
      },
    },
    {
      accessorKey: "contributionPct",
      header: "Contribution",
      cell: (c) => `${c.getValue<number>().toFixed(1)}%`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Sales</h1>
        <p className="text-sm text-text-muted">Revenue, orders, and performance for the current month</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Revenue" value={overview ? formatCurrency(overview.revenue) : "—"} icon={IndianRupee} />
        <KpiCard label="Orders" value={overview ? formatNumber(overview.orders) : "—"} icon={ShoppingCart} />
        <KpiCard label="Avg Order Value" value={overview ? formatCurrency(overview.aov) : "—"} icon={Wallet} />
        <KpiCard label="Monthly Target" value={overview?.targetRevenue ? formatCurrency(overview.targetRevenue) : "—"} icon={Target} />
        <KpiCard
          label="Achievement"
          value={overview ? formatPercent(overview.achievement) : "—"}
          icon={Target}
          deltaTone={
            overview?.achievement == null ? "neutral" : overview.achievement >= 100 ? "good" : overview.achievement >= 80 ? "neutral" : "critical"
          }
        />
        <KpiCard
          label="Growth"
          value={overview ? formatPercent(overview.growth, { signed: true }) : "—"}
          icon={overview?.growth != null && overview.growth < 0 ? TrendingDown : TrendingUp}
          deltaTone={overview?.growth == null ? "neutral" : overview.growth >= 0 ? "good" : "critical"}
          sub="vs previous month"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Revenue Trend</CardTitle>
          <div className="flex gap-1 rounded-sm border border-border p-0.5">
            {GRANULARITIES.map((g) => (
              <button
                key={g.key}
                onClick={() => setGranularity(g.key)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  granularity === g.key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {trendQuery.data && trendQuery.data.length > 0 ? (
            <RevenueTrendChart data={trendQuery.data} granularity={granularity} />
          ) : (
            <EmptyState title="No trend data" description="Revenue trend will appear once orders exist in this window." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-1 rounded-sm border border-border p-0.5" style={{ width: "fit-content" }}>
            {BREAKDOWN_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setBreakdownTab(tab.key)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  breakdownTab === tab.key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {breakdownQuery.data && breakdownQuery.data.length > 0 ? (
            <RankedBarList
              entries={breakdownQuery.data.map((e) => ({
                label: `${e.name}${e.orders ? ` · ${formatNumber(e.orders)} orders` : ""}`,
                value: e.revenue,
                displayValue: formatCurrency(e.revenue),
              }))}
            />
          ) : (
            <EmptyState title="No breakdown data yet" />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-text-primary">Product Performance</h2>
        <DataTable
          columns={columns}
          data={tableQuery.data?.data ?? []}
          meta={tableQuery.data?.meta ?? { page: 1, pageSize: state.pageSize, total: 0, totalPages: 1 }}
          page={state.page}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={(updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater;
            if (next[0]) setSort(next[0].id);
          }}
          query={state.q}
          onQueryChange={setQuery}
          searchPlaceholder="Search product name or SKU…"
          isLoading={tableQuery.isLoading}
          isError={tableQuery.isError}
          onRetry={() => tableQuery.refetch()}
          emptyMessage="No products match your search."
        />
      </div>
    </div>
  );
}

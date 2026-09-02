"use client";

import { useState } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { AlertTriangle, Boxes, IndianRupee, Layers, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { PaginatedResponse, ProductListItem, ProductsStatSummary } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useDateRangeParams } from "@/hooks/useDateRangeParams";
import {
  useProductCategories,
  useProductsByCategory,
  useProductsCatalog,
  useProductsNeedsAttention,
  useProductsStatSummary,
} from "@/lib/query/useProducts";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { RankedBarList } from "@/components/shared/RankedBarList";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const DEMAND_TIER_VARIANT = { High: "good", Medium: "warning", Low: "neutral" } as const;

export function ProductsView({
  initialCatalog,
  initialStats,
}: {
  initialCatalog: PaginatedResponse<ProductListItem> | null;
  initialStats: ProductsStatSummary | null;
}) {
  const { state, setPage, setSort, setQuery, patch } = useTableState({ pageSize: 10 });
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);
  const { dateFrom, dateTo } = useDateRangeParams();
  const range = { dateFrom, dateTo };

  const catalogQuery = useProductsCatalog(
    { ...state, q: debouncedQuery, categoryId, ...range },
    initialCatalog ?? undefined,
  );
  const statsQuery = useProductsStatSummary(range, initialStats ?? undefined);
  const categoryBreakdownQuery = useProductsByCategory(range);
  const needsAttentionQuery = useProductsNeedsAttention(range);
  const categoriesQuery = useProductCategories();

  const stats = statsQuery.data;

  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<ProductListItem, any>[] = [
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "categoryName", header: "Category", enableSorting: false },
    { accessorKey: "design", header: "Design", enableSorting: false, cell: (c) => c.getValue() ?? "—" },
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
      accessorKey: "demandTier",
      header: "Demand",
      enableSorting: false,
      cell: (c) => {
        const tier = c.getValue<ProductListItem["demandTier"]>();
        return <Badge variant={DEMAND_TIER_VARIANT[tier]}>{tier}</Badge>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Products</h1>
        <p className="text-sm text-text-muted">HPL shade &amp; design performance analytics</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        <KpiCard label="Total SKUs" value={stats ? formatNumber(stats.totalSkus) : "—"} icon={Package} />
        <KpiCard label="Units Sold" value={stats ? formatNumber(stats.unitsSold) : "—"} icon={Boxes} />
        <KpiCard label="Total Orders" value={stats ? formatNumber(stats.totalOrders) : "—"} icon={ShoppingCart} />
        <KpiCard label="Total Revenue" value={stats ? formatCurrency(stats.totalRevenue) : "—"} icon={IndianRupee} />
        <KpiCard
          label="Avg Growth"
          value={stats ? formatPercent(stats.avgGrowth, { signed: true }) : "—"}
          icon={TrendingUp}
          deltaTone={stats?.avgGrowth == null ? "neutral" : stats.avgGrowth >= 0 ? "good" : "critical"}
        />
        <KpiCard
          label="Best-Selling Shade"
          value={stats?.bestSellingShade?.name ?? "—"}
          sub={stats?.bestSellingShade ? `${stats.bestSellingShade.pctOfTotal.toFixed(0)}% of units` : undefined}
          icon={Layers}
        />
        <KpiCard
          label="Best-Selling Design"
          value={stats?.bestSellingDesign?.name ?? "—"}
          sub={stats?.bestSellingDesign ? `${stats.bestSellingDesign.pctOfTotal.toFixed(0)}% of revenue` : undefined}
          icon={Layers}
        />
        <KpiCard
          label="Highest Demand"
          value={stats?.highestDemandCategory?.name ?? "—"}
          sub={stats?.highestDemandCategory ? `${formatNumber(stats.highestDemandCategory.value)} units` : undefined}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By HPL Type</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdownQuery.data && categoryBreakdownQuery.data.length > 0 ? (
              <RankedBarList
                entries={categoryBreakdownQuery.data.map((c) => ({
                  label: `${c.categoryName} · ${c.skuCount} SKUs`,
                  value: c.units,
                  displayValue: formatCurrency(c.revenue),
                }))}
              />
            ) : (
              <EmptyState icon={Layers} title="No sales data yet" description="Category revenue breakdown fills in once orders are recorded." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttentionQuery.data && needsAttentionQuery.data.length > 0 ? (
              <div className="flex flex-col gap-2">
                {needsAttentionQuery.data.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openDrawer("product", p)}
                    className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-left hover:bg-surface-hover"
                  >
                    <span className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-critical" />
                      <span className="font-medium text-text-primary">{p.sku}</span>
                    </span>
                    <span className="text-xs font-medium text-critical">{formatPercent(p.growth, { signed: true })}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={AlertTriangle} title="Nothing needs attention" description="Products with declining growth will show up here once sales data exists." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-text-primary">All Products</h2>
          {categoriesQuery.data && (
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || undefined)}
              className="h-8 rounded-sm border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="">All categories</option>
              {categoriesQuery.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <DataTable
          columns={columns}
          data={catalogQuery.data?.data ?? []}
          meta={catalogQuery.data?.meta ?? { page: 1, pageSize: state.pageSize, total: 0, totalPages: 1 }}
          page={state.page}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={(updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater;
            if (next[0]) setSort(next[0].id);
          }}
          query={state.q}
          onQueryChange={setQuery}
          onRowClick={(row) => openDrawer("product", row)}
          searchPlaceholder="Search SKU or product name…"
          isLoading={catalogQuery.isLoading}
          isError={catalogQuery.isError}
          onRetry={() => catalogQuery.refetch()}
          emptyMessage="No products match your search."
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { IndianRupee, MessageSquareWarning, ShieldAlert, ShieldCheck, TrendingUp, UserCheck, UserPlus, Users } from "lucide-react";
import { CustomerListItem, CustomerSegment, CustomersKpis, PaginatedResponse } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useDateRangeParams } from "@/hooks/useDateRangeParams";
import {
  useCustomersAtRisk,
  useCustomersKpis,
  useCustomersLeaderboard,
  useCustomersList,
} from "@/lib/query/useCustomers";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { AttentionFeed } from "@/components/shared/AttentionFeed";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerSegmentBadge } from "./CustomerSegmentBadge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";

const TYPE_LABEL: Record<CustomerListItem["type"], string> = {
  INDIVIDUAL: "Individual",
  BUSINESS: "Business",
  DEALER_SELF: "Dealer",
};

const SEGMENT_FILTERS: { key: CustomerSegment | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "NEW", label: "New" },
  { key: "AT_RISK", label: "At Risk" },
  { key: "DORMANT", label: "Dormant" },
];

export function CustomersView({
  initialKpis,
  initialList,
}: {
  initialKpis: CustomersKpis | null;
  initialList: PaginatedResponse<CustomerListItem> | null;
}) {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10 });
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | undefined>(undefined);
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);
  const { dateFrom, dateTo } = useDateRangeParams();
  const range = { dateFrom, dateTo };

  const kpisQuery = useCustomersKpis(range, initialKpis ?? undefined);
  const leaderboardQuery = useCustomersLeaderboard(range);
  const atRiskQuery = useCustomersAtRisk(range);
  const listQuery = useCustomersList({ ...state, q: debouncedQuery, segment: segmentFilter, ...range }, initialList ?? undefined);

  const kpis = kpisQuery.data;
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<CustomerListItem, any>[] = [
    { accessorKey: "name", header: "Customer", cell: (c) => c.row.original.companyName ?? c.getValue() },
    { accessorKey: "state", header: "Location", enableSorting: false, cell: (c) => `${c.row.original.city}, ${c.row.original.state}` },
    { accessorKey: "type", header: "Type", enableSorting: false, cell: (c) => TYPE_LABEL[c.getValue<CustomerListItem["type"]>()] },
    { accessorKey: "lifetimeValue", header: "Lifetime Value", cell: (c) => formatCurrency(c.getValue()) },
    {
      accessorKey: "lastPurchaseAt",
      header: "Last Purchase",
      cell: (c) => {
        const v = c.getValue<string | null>();
        return v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
      },
    },
    {
      accessorKey: "segment",
      header: "Segment",
      enableSorting: false,
      cell: (c) => <CustomerSegmentBadge segment={c.getValue()} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Customers</h1>
        <p className="text-sm text-text-muted">Customer profiles, purchase history and lifetime value</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        <KpiCard label="Total Customers" value={kpis ? formatNumber(kpis.totalCustomers) : "—"} icon={Users} />
        <KpiCard label="New This Month" value={kpis ? formatNumber(kpis.newThisMonth) : "—"} icon={UserPlus} />
        <KpiCard label="Total Lifetime Value" value={kpis ? formatCurrency(kpis.totalLifetimeValue) : "—"} icon={IndianRupee} />
        <KpiCard label="Avg Lifetime Value" value={kpis ? formatCurrency(kpis.avgLifetimeValue) : "—"} icon={TrendingUp} />
        <KpiCard label="Active Customers" value={kpis ? formatNumber(kpis.activeCustomers) : "—"} icon={UserCheck} />
        <KpiCard label="At-Risk Customers" value={kpis ? formatNumber(kpis.atRiskCustomers) : "—"} icon={ShieldAlert} />
        <KpiCard label="Open Complaints" value={kpis ? formatNumber(kpis.openComplaints) : "—"} icon={MessageSquareWarning} />
        <KpiCard label="Active Warranty Claims" value={kpis ? formatNumber(kpis.activeWarrantyClaims) : "—"} icon={ShieldCheck} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Customers by Lifetime Value</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardQuery.data && leaderboardQuery.data.length > 0 ? (
              <Leaderboard
                entries={leaderboardQuery.data.map((c, i) => ({
                  id: c.id,
                  rank: i + 1,
                  name: c.name,
                  primaryValue: formatCurrency(c.lifetimeValue),
                  secondaryLabel: `${formatNumber(c.totalOrders)} orders`,
                }))}
                onEntryClick={(id) => {
                  const customer = listQuery.data?.data.find((c) => c.id === id);
                  if (customer) openDrawer("customer", customer);
                }}
              />
            ) : (
              <EmptyState icon={Users} title="No customers yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>At-Risk / Dormant Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {atRiskQuery.data && atRiskQuery.data.length > 0 ? (
              <AttentionFeed
                items={atRiskQuery.data.map((c) => ({
                  id: c.id,
                  title: c.name,
                  meta: `${c.city}, ${c.state}`,
                  value: formatCurrency(c.lifetimeValue),
                  priority: c.segment === "DORMANT" ? "critical" : "high",
                }))}
                onItemClick={(id) => {
                  const customer = atRiskQuery.data?.find((c) => c.id === id);
                  if (customer) openDrawer("customer", customer);
                }}
              />
            ) : (
              <EmptyState icon={ShieldAlert} title="No customers at risk" description="At-risk and dormant customers will show up here." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-text-primary">All Customers</h2>
          <div className="flex gap-1 rounded-sm border border-border p-0.5">
            {SEGMENT_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setSegmentFilter(f.key === "ALL" ? undefined : (f.key as CustomerSegment));
                  setPage(1);
                }}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  (segmentFilter ?? "ALL") === f.key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
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
          onRowClick={(row) => openDrawer("customer", row)}
          searchPlaceholder="Search customer name, code or phone…"
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No customers match your search."
        />
      </div>
    </div>
  );
}

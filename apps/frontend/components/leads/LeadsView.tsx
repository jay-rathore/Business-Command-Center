"use client";

import { useState } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { CheckCircle2, TrendingUp, UserPlus, Users, XCircle } from "lucide-react";
import { FunnelStage, LeadListItem, LeadsKpis, PaginatedResponse } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useLeadStatuses, useLeadsFunnel, useLeadsKpis, useLeadsList, useLeadsSources } from "@/lib/query/useLeads";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { FunnelChart } from "@/components/shared/FunnelChart";
import { RankedBarList } from "@/components/shared/RankedBarList";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { ScanBusinessCardDialog } from "./ScanBusinessCardDialog";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export function LeadsView({
  initialKpis,
  initialFunnel,
  initialList,
}: {
  initialKpis: LeadsKpis | null;
  initialFunnel: FunnelStage[] | null;
  initialList: PaginatedResponse<LeadListItem> | null;
}) {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10, sortBy: "createdAt" });
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);

  const kpisQuery = useLeadsKpis(initialKpis ?? undefined);
  const funnelQuery = useLeadsFunnel(initialFunnel ?? undefined);
  const sourcesQuery = useLeadsSources();
  const statusesQuery = useLeadStatuses();
  const listQuery = useLeadsList({ ...state, q: debouncedQuery, statusId: statusFilter }, initialList ?? undefined);

  const kpis = kpisQuery.data;
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<LeadListItem, any>[] = [
    { accessorKey: "name", header: "Lead", cell: (c) => (
      <span>
        <span className="block font-medium text-text-primary">{c.getValue()}</span>
        {c.row.original.company && <span className="block text-xs text-text-muted">{c.row.original.company}</span>}
      </span>
    ) },
    {
      accessorKey: "sources",
      header: "Source",
      enableSorting: false,
      cell: (c) => {
        const sources = c.row.original.sources;
        return <span>{sources.length > 0 ? sources.map((s) => s.name).join(", ") : "—"}</span>;
      },
    },
    { accessorKey: "assignedExecName", header: "Assigned To", enableSorting: false, cell: (c) => c.getValue() ?? "Unassigned" },
    { accessorKey: "score", header: "Score" },
    { accessorKey: "estimatedValue", header: "Value", cell: (c) => (c.getValue() ? formatCurrency(c.getValue()) : "—") },
    {
      accessorKey: "nextFollowUpAt",
      header: "Next Follow-up",
      cell: (c) => {
        const val = c.getValue<string | null>();
        if (!val) return "—";
        const label = new Date(val).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        return c.row.original.isOverdue ? <span className="text-critical">{label} · overdue</span> : label;
      },
    },
    { accessorKey: "status", header: "Status", enableSorting: false, cell: (c) => <LeadStatusBadge status={c.getValue()} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Leads</h1>
        <p className="text-sm text-text-muted">Pipeline, sources and follow-up tracking</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        <KpiCard label="Total Leads" value={kpis ? formatNumber(kpis.totalLeads) : "—"} icon={Users} />
        <KpiCard label="New This Month" value={kpis ? formatNumber(kpis.newThisMonth) : "—"} icon={UserPlus} />
        <KpiCard label="Qualified" value={kpis ? formatNumber(kpis.qualified) : "—"} icon={CheckCircle2} />
        <KpiCard label="Pending" value={kpis ? formatNumber(kpis.pending) : "—"} icon={Users} />
        <KpiCard label="Won" value={kpis ? formatNumber(kpis.won) : "—"} icon={CheckCircle2} deltaTone="good" />
        <KpiCard label="Lost" value={kpis ? formatNumber(kpis.lost) : "—"} icon={XCircle} deltaTone="critical" />
        <KpiCard label="Conversion Rate" value={kpis ? formatPercent(kpis.conversionRate) : "—"} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelQuery.data && funnelQuery.data.length > 0 ? (
              <FunnelChart stages={funnelQuery.data.map((s) => ({ label: s.label, count: s.count }))} />
            ) : (
              <EmptyState title="No funnel data yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesQuery.data && sourcesQuery.data.length > 0 ? (
              <RankedBarList
                entries={sourcesQuery.data.map((s) => ({
                  label: s.source.name,
                  value: s.count,
                  displayValue: formatNumber(s.count),
                }))}
              />
            ) : (
              <EmptyState title="No source data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-text-primary">All Leads</h2>
          <Button type="button" size="sm" onClick={() => setScanDialogOpen(true)}>
            Scan Business Card
          </Button>
        </div>
        <select
          value={statusFilter ?? "ALL"}
          onChange={(e) => {
            setStatusFilter(e.target.value === "ALL" ? undefined : e.target.value);
            setPage(1);
          }}
          className="h-8 w-fit rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
        >
          <option value="ALL">All statuses</option>
          {(statusesQuery.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

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
          onRowClick={(row) => openDrawer("lead", row)}
          searchPlaceholder="Search name, company or phone…"
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No leads match your search."
        />
      </div>

      <ScanBusinessCardDialog open={scanDialogOpen} onOpenChange={setScanDialogOpen} />
    </div>
  );
}

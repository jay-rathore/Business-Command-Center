"use client";

import { ColumnDef, SortingState } from "@tanstack/react-table";
import { AlertTriangle, IndianRupee, Target, UserCog, Users } from "lucide-react";
import { FollowUpRiskLead, PaginatedResponse, SalesTeamExecutive, SalesTeamKpis } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useDateRangeParams } from "@/hooks/useDateRangeParams";
import { useSalesTeamFollowUpRisk, useSalesTeamKpis, useSalesTeamLeaderboard, useSalesTeamList } from "@/lib/query/useSalesTeam";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { AttentionFeed, AttentionFeedItem } from "@/components/shared/AttentionFeed";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

function overdueSeverity(daysOverdue: number): AttentionFeedItem["priority"] {
  if (daysOverdue >= 14) return "critical";
  if (daysOverdue >= 7) return "high";
  return "medium";
}

export function SalesTeamView({
  initialKpis,
  initialList,
}: {
  initialKpis: SalesTeamKpis | null;
  initialList: PaginatedResponse<SalesTeamExecutive> | null;
}) {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10, sortBy: "revenue" });
  const debouncedQuery = useDebounce(state.q);
  const { dateFrom, dateTo } = useDateRangeParams();
  const range = { dateFrom, dateTo };

  const kpisQuery = useSalesTeamKpis(range, initialKpis ?? undefined);
  const leaderboardQuery = useSalesTeamLeaderboard(range);
  const riskQuery = useSalesTeamFollowUpRisk();
  const listQuery = useSalesTeamList({ ...state, q: debouncedQuery, ...range }, initialList ?? undefined);

  const kpis = kpisQuery.data;
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<SalesTeamExecutive, any>[] = [
    { accessorKey: "name", header: "Executive" },
    { accessorKey: "designation", header: "Designation", enableSorting: false },
    { accessorKey: "state", header: "State", enableSorting: false, cell: (c) => c.getValue() ?? "—" },
    { accessorKey: "revenue", header: "Revenue", cell: (c) => formatCurrency(c.getValue()) },
    { accessorKey: "orders", header: "Orders", cell: (c) => formatNumber(c.getValue()) },
    { accessorKey: "leadsAssigned", header: "Leads", cell: (c) => formatNumber(c.getValue()) },
    { accessorKey: "leadsWon", header: "Won", cell: (c) => formatNumber(c.getValue()) },
    {
      accessorKey: "conversionRate",
      header: "Conversion",
      cell: (c) => {
        const v = c.getValue<number | null>();
        return v === null ? "—" : formatPercent(v);
      },
    },
    {
      accessorKey: "targetRevenue",
      header: "Target",
      cell: (c) => {
        const v = c.getValue<number | null>();
        return v === null ? "—" : formatCurrency(v);
      },
    },
    {
      accessorKey: "achievementPct",
      header: "Achievement",
      cell: (c) => {
        const v = c.getValue<number | null>();
        if (v === null) return "—";
        return <span className={v >= 100 ? "text-good" : v >= 80 ? "text-text-primary" : "text-critical"}>{formatPercent(v)}</span>;
      },
    },
    {
      accessorKey: "overdueFollowUps",
      header: "Overdue",
      cell: (c) => {
        const v = c.getValue<number>();
        return v > 0 ? <span className="text-critical">{v}</span> : "0";
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Sales Team</h1>
        <p className="text-sm text-text-muted">
          Per-executive performance, leaderboard, and follow-up risk {dateFrom || dateTo ? "for the selected range" : "for the current month"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Active Executives" value={kpis ? formatNumber(kpis.activeExecutives) : "—"} icon={Users} />
        <KpiCard label="Team Revenue" value={kpis ? formatCurrency(kpis.teamRevenue) : "—"} icon={IndianRupee} />
        <KpiCard label="Team Target" value={kpis?.teamTargetRevenue != null ? formatCurrency(kpis.teamTargetRevenue) : "—"} icon={Target} />
        <KpiCard
          label="Achievement"
          value={kpis ? formatPercent(kpis.teamAchievement) : "—"}
          icon={Target}
          deltaTone={kpis?.teamAchievement == null ? "neutral" : kpis.teamAchievement >= 100 ? "good" : kpis.teamAchievement >= 80 ? "neutral" : "critical"}
        />
        <KpiCard
          label="Overdue Follow-ups"
          value={kpis ? formatNumber(kpis.overdueFollowUps) : "—"}
          icon={AlertTriangle}
          deltaTone={kpis && kpis.overdueFollowUps > 0 ? "critical" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardQuery.data && leaderboardQuery.data.length > 0 ? (
              <Leaderboard
                entries={leaderboardQuery.data.map((e, i) => ({
                  id: e.id,
                  rank: i + 1,
                  name: e.name,
                  primaryValue: formatCurrency(e.revenue),
                  secondaryLabel: `${e.achievementPct != null ? `${formatPercent(e.achievementPct)} of target · ` : ""}${formatNumber(e.orders)} orders`,
                }))}
              />
            ) : (
              <EmptyState icon={UserCog} title="No executives yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Follow-up Risk</CardTitle>
          </CardHeader>
          <CardContent>
            {riskQuery.data && riskQuery.data.length > 0 ? (
              <AttentionFeed
                items={riskQuery.data.map((lead: FollowUpRiskLead) => ({
                  id: lead.id,
                  title: `${lead.name}${lead.company ? ` · ${lead.company}` : ""}`,
                  meta: `${lead.execName ?? "Unassigned"} · ${lead.statusName ?? "No status"}`,
                  value: `${lead.daysOverdue}d overdue`,
                  priority: overdueSeverity(lead.daysOverdue),
                }))}
              />
            ) : (
              <EmptyState icon={AlertTriangle} title="No overdue follow-ups" description="Leads past their next follow-up date will show up here." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-text-primary">All Executives</h2>
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
          searchPlaceholder="Search executive name or code…"
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No executives match your search."
        />
      </div>
    </div>
  );
}

"use client";

import { ColumnDef, SortingState } from "@tanstack/react-table";
import { Compass, FlaskConical, FolderKanban, IndianRupee, UserPlus, Users } from "lucide-react";
import { PaginatedResponse, ReferralPartnerKpis, ReferralPartnerListItem } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useDateRangeParams } from "@/hooks/useDateRangeParams";
import {
  useArchitectsKpis,
  useArchitectsLeaderboard,
  useArchitectsList,
  useArchitectsRecentReferrals,
} from "@/lib/query/useArchitects";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { ReferralFeed } from "@/components/shared/ReferralFeed";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";

export function ArchitectsView({
  initialKpis,
  initialList,
}: {
  initialKpis: ReferralPartnerKpis | null;
  initialList: PaginatedResponse<ReferralPartnerListItem> | null;
}) {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10, sortBy: "projectValue" });
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);
  const { dateFrom, dateTo } = useDateRangeParams();
  const range = { dateFrom, dateTo };

  const kpisQuery = useArchitectsKpis(range, initialKpis ?? undefined);
  const leaderboardQuery = useArchitectsLeaderboard(range);
  const referralsQuery = useArchitectsRecentReferrals();
  const listQuery = useArchitectsList({ ...state, q: debouncedQuery, ...range }, initialList ?? undefined);

  const kpis = kpisQuery.data;
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const columns: ColumnDef<ReferralPartnerListItem, any>[] = [
    { accessorKey: "name", header: "Architect" },
    { accessorKey: "company", header: "Company", enableSorting: false, cell: (c) => c.getValue() ?? "—" },
    { accessorKey: "city", header: "City", enableSorting: false, cell: (c) => `${c.row.original.city}, ${c.row.original.state}` },
    { accessorKey: "projectsReferred", header: "Projects", cell: (c) => formatNumber(c.getValue()) },
    { accessorKey: "leadsReferred", header: "Leads", cell: (c) => formatNumber(c.getValue()) },
    { accessorKey: "sampleRequestsSent", header: "Samples", cell: (c) => formatNumber(c.getValue()) },
    { accessorKey: "projectValue", header: "Project Value", cell: (c) => formatCurrency(c.getValue()) },
    { accessorKey: "revenueInfluenced", header: "Revenue Influenced", cell: (c) => formatCurrency(c.getValue()) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Architects</h1>
        <p className="text-sm text-text-muted">Referral partner directory — projects, leads, samples and revenue influenced</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Total Architects" value={kpis ? formatNumber(kpis.total) : "—"} icon={Compass} />
        <KpiCard label="New This Month" value={kpis ? formatNumber(kpis.newThisMonth) : "—"} icon={UserPlus} />
        <KpiCard label="Projects Referred" value={kpis ? formatNumber(kpis.projectsReferred) : "—"} icon={FolderKanban} />
        <KpiCard label="Leads Referred" value={kpis ? formatNumber(kpis.leadsReferred) : "—"} icon={Users} />
        <KpiCard label="Sample Requests" value={kpis ? formatNumber(kpis.sampleRequestsSent) : "—"} icon={FlaskConical} />
        <KpiCard label="Project Value" value={kpis ? formatCurrency(kpis.projectValue) : "—"} icon={IndianRupee} />
        <KpiCard label="Revenue Influenced" value={kpis ? formatCurrency(kpis.revenueInfluenced) : "—"} icon={IndianRupee} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Architects</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardQuery.data && leaderboardQuery.data.length > 0 ? (
              <Leaderboard
                entries={leaderboardQuery.data.map((a, i) => ({
                  id: a.id,
                  rank: i + 1,
                  name: a.name,
                  primaryValue: formatCurrency(a.projectValue),
                  secondaryLabel: `${formatNumber(a.projects)} projects · ${formatCurrency(a.revenueInfluenced)} revenue`,
                }))}
                onEntryClick={(id) => {
                  const architect = listQuery.data?.data.find((a) => a.id === id);
                  if (architect) openDrawer("architect", architect);
                }}
              />
            ) : (
              <EmptyState icon={Compass} title="No architects yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {referralsQuery.data && referralsQuery.data.length > 0 ? (
              <ReferralFeed
                items={referralsQuery.data.map((r) => ({
                  id: r.id,
                  title: r.projectName,
                  meta: `${r.partnerName} · ${r.stage}`,
                  value: formatCurrency(r.estimatedValue),
                }))}
              />
            ) : (
              <EmptyState icon={FolderKanban} title="No referrals yet" description="Projects referred by an architect will show up here." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-text-primary">All Architects</h2>
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
          onRowClick={(row) => openDrawer("architect", row)}
          searchPlaceholder="Search architect name, company or city…"
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No architects match your search."
        />
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { AlertTriangle, Briefcase, Clock, IndianRupee, Percent, Target, TrendingUp, Trophy } from "lucide-react";
import { KanbanColumn, ProjectListItem, ProjectsKpis, ProjectStage } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useProjectsClosingSoon,
  useProjectsKanban,
  useProjectsKpis,
  useProjectsList,
  useProjectsStuck,
} from "@/lib/query/useProjects";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { AttentionFeed } from "@/components/shared/AttentionFeed";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KanbanBoard } from "./KanbanBoard";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const STAGE_FILTERS: { key: ProjectStage | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "LEAD", label: "Lead" },
  { key: "DISCOVERY", label: "Discovery" },
  { key: "SAMPLE", label: "Sample" },
  { key: "DESIGN_APPROVAL", label: "Design Approval" },
  { key: "QUOTATION", label: "Quotation" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "ORDER", label: "Order" },
  { key: "COMPLETED", label: "Completed" },
  { key: "LOST", label: "Lost" },
];

type WatchlistTab = "high-value" | "stuck" | "closing-soon";

export function ProjectsView({
  initialKpis,
  initialKanban,
}: {
  initialKpis: ProjectsKpis | null;
  initialKanban: KanbanColumn[] | null;
}) {
  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10 });
  const [stageFilter, setStageFilter] = useState<ProjectStage | undefined>(undefined);
  const [watchlistTab, setWatchlistTab] = useState<WatchlistTab>("stuck");
  const debouncedQuery = useDebounce(state.q);
  const openDrawer = useDrawerStore((s) => s.open);

  const kpisQuery = useProjectsKpis(initialKpis ?? undefined);
  const kanbanQuery = useProjectsKanban(initialKanban ?? undefined);
  const stuckQuery = useProjectsStuck();
  const closingSoonQuery = useProjectsClosingSoon();
  const listQuery = useProjectsList({ ...state, q: debouncedQuery, stage: stageFilter });

  const kpis = kpisQuery.data;
  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  const highValueProjects = useMemo(() => {
    if (!kanbanQuery.data) return [];
    return kanbanQuery.data
      .flatMap((c) => c.projects)
      .filter((p) => p.stage !== "COMPLETED" && p.stage !== "LOST")
      .sort((a, b) => b.estimatedValue - a.estimatedValue)
      .slice(0, 8);
  }, [kanbanQuery.data]);

  const columns: ColumnDef<ProjectListItem, any>[] = [
    { accessorKey: "name", header: "Project" },
    { accessorKey: "customerName", header: "Customer", enableSorting: false, cell: (c) => c.getValue() ?? "—" },
    { accessorKey: "salesExecName", header: "Executive", enableSorting: false, cell: (c) => c.getValue() ?? "Unassigned" },
    { accessorKey: "estimatedValue", header: "Value", cell: (c) => formatCurrency(c.getValue()) },
    { accessorKey: "probability", header: "Probability", cell: (c) => `${c.getValue()}%` },
    {
      accessorKey: "expectedCloseAt",
      header: "Expected Close",
      cell: (c) => {
        const v = c.getValue<string | null>();
        return v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
      },
    },
    { accessorKey: "stage", header: "Stage", enableSorting: false, cell: (c) => <ProjectStageBadge stage={c.getValue()} /> },
  ];

  const watchlistItems =
    watchlistTab === "stuck"
      ? (stuckQuery.data ?? []).map((p) => ({
          id: p.id,
          title: p.name,
          meta: `${p.daysInStage} days in ${p.stage.replace("_", " ").toLowerCase()}`,
          value: formatCurrency(p.estimatedValue),
          priority: "high" as const,
        }))
      : watchlistTab === "closing-soon"
        ? (closingSoonQuery.data ?? []).map((p) => ({
            id: p.id,
            title: p.name,
            meta: p.expectedCloseAt ? `Closes ${new Date(p.expectedCloseAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "",
            value: formatCurrency(p.estimatedValue),
            priority: "medium" as const,
          }))
        : highValueProjects.map((p) => ({
            id: p.id,
            title: p.name,
            meta: `${p.probability}% · ${p.stage.replace("_", " ").toLowerCase()}`,
            value: formatCurrency(p.estimatedValue),
            priority: "medium" as const,
          }));

  function openProjectById(id: string) {
    const project =
      kanbanQuery.data?.flatMap((c) => c.projects).find((p) => p.id === id) ?? listQuery.data?.data.find((p) => p.id === id);
    if (project) openDrawer("project", project);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Projects</h1>
        <p className="text-sm text-text-muted">Enterprise sales pipeline — Lead to Completed</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        <KpiCard label="Total Projects" value={kpis ? formatNumber(kpis.totalProjects) : "—"} icon={Briefcase} />
        <KpiCard label="Active Pipeline" value={kpis ? formatNumber(kpis.activePipeline) : "—"} icon={TrendingUp} />
        <KpiCard label="Pipeline Value" value={kpis ? formatCurrency(kpis.pipelineValue) : "—"} icon={IndianRupee} />
        <KpiCard label="Weighted Pipeline" value={kpis ? formatCurrency(kpis.weightedPipeline) : "—"} icon={Target} />
        <KpiCard label="Orders Won" value={kpis ? formatNumber(kpis.ordersWon) : "—"} icon={Trophy} />
        <KpiCard label="Win Rate" value={kpis ? formatPercent(kpis.winRate) : "—"} icon={Percent} />
        <KpiCard label="Avg Deal Size" value={kpis ? formatCurrency(kpis.avgDealSize) : "—"} icon={IndianRupee} />
        <KpiCard
          label="Stuck Projects"
          value={kpis ? formatNumber(kpis.stuckProjects) : "—"}
          icon={AlertTriangle}
          deltaTone={kpis && kpis.stuckProjects > 0 ? "critical" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Board</CardTitle>
        </CardHeader>
        <CardContent>
          {kanbanQuery.data ? (
            <KanbanBoard columns={kanbanQuery.data} onCardClick={(p) => openDrawer("project", p)} />
          ) : (
            <EmptyState title="Loading pipeline…" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Watchlist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-1 rounded-sm border border-border p-0.5" style={{ width: "fit-content" }}>
            {(["stuck", "closing-soon", "high-value"] as WatchlistTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setWatchlistTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  watchlistTab === tab ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
                )}
              >
                {tab === "stuck" && <Clock className="h-3 w-3" />}
                {tab === "stuck" ? "Stuck" : tab === "closing-soon" ? "Closing Soon" : "High Value"}
              </button>
            ))}
          </div>
          {watchlistItems.length > 0 ? (
            <AttentionFeed items={watchlistItems} onItemClick={openProjectById} />
          ) : (
            <EmptyState icon={Clock} title="Nothing here" description="This watchlist is empty right now." />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-text-primary">All Projects</h2>
        <div className="flex flex-wrap gap-1 rounded-sm border border-border p-0.5" style={{ width: "fit-content" }}>
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setStageFilter(f.key === "ALL" ? undefined : (f.key as ProjectStage));
                setPage(1);
              }}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                (stageFilter ?? "ALL") === f.key ? "bg-accent-tint text-accent-strong" : "text-text-muted hover:text-text-primary",
              )}
            >
              {f.label}
            </button>
          ))}
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
          onRowClick={(row) => openDrawer("project", row)}
          searchPlaceholder="Search project name, code or city…"
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No projects match your search."
        />
      </div>
    </div>
  );
}

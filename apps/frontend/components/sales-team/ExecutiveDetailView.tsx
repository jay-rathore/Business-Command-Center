"use client";

import { useState } from "react";
import Link from "next/link";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, IndianRupee, PhoneCall, ShoppingCart, Target, ThumbsUp, TrendingUp, UserPlus, Users, XCircle } from "lucide-react";
import { ExecutiveOverview, LeadListItem } from "@hpl/shared";
import { useTableState } from "@/hooks/useTableState";
import { useDebounce } from "@/hooks/useDebounce";
import { useDateRangeParams } from "@/hooks/useDateRangeParams";
import { useExecutiveOverview } from "@/lib/query/useSalesTeam";
import { useLeadsList, useLeadStatuses } from "@/lib/query/useLeads";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { DataTable } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadOutcomesCard } from "@/components/leads/LeadOutcomesCard";
import { SourcePerformanceCard } from "@/components/leads/SourcePerformanceCard";
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";
import { formatCurrency, formatNumber, formatPercent, formatRupees } from "@/lib/format";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

// For these rates a LOWER number is the good direction.
const LOWER_IS_BETTER = new Set(["lost", "lostOfWorked"]);

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-sm border border-border px-3 py-2">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

/** One sales executive, in full: how their leads turned out (won / interested / not interested / lost and why),
 * which sources work for them, month-by-month trend, revenue, follow-ups, activity, and every lead they hold. */
export function ExecutiveDetailView({ id }: { id: string }) {
  const { dateFrom, dateTo } = useDateRangeParams();
  const range = { dateFrom, dateTo };
  const overviewQuery = useExecutiveOverview(id, range);
  const data = overviewQuery.data;

  const { state, setPage, setSort, setQuery } = useTableState({ pageSize: 10, sortBy: "createdAt" });
  const debouncedQuery = useDebounce(state.q);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const statusesQuery = useLeadStatuses();
  const listQuery = useLeadsList({ ...state, q: debouncedQuery, statusId: statusFilter, sourceId: sourceFilter, assignedExecId: id, ...range });
  const openDrawer = useDrawerStore((s) => s.open);

  const sorting: SortingState = state.sortBy ? [{ id: state.sortBy, desc: state.sortDir === "desc" }] : [];

  function showLeads(filter: { status?: string; source?: string }) {
    setStatusFilter(filter.status);
    setSourceFilter(filter.source);
    setPage(1);
    document.getElementById("exec-leads")?.scrollIntoView({ behavior: "smooth" });
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/sales-team" className="flex w-fit items-center gap-1 text-sm text-text-muted hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Sales Team
        </Link>
        {overviewQuery.isError ? <EmptyState icon={AlertTriangle} title="Couldn't load this executive" description="They may not exist, or you may not have access." /> : <p className="text-sm text-text-muted">Loading…</p>}
      </div>
    );
  }

  const { executive: ex, lead, revenue, projects, documents, activity } = data;
  const teamRate = (key: string) => data.teamRates.find((r) => r.key === key)?.value ?? null;
  const rate = (key: string) => data.outcomes.rates.find((r) => r.key === key)?.value ?? null;
  const maxMonth = Math.max(1, ...data.monthly.flatMap((m) => [m.assigned, m.won, m.lost]));

  const columns: ColumnDef<LeadListItem, any>[] = [
    {
      accessorKey: "name",
      header: "Lead",
      cell: (c) => (
        <span>
          <span className="block font-medium text-text-primary">{c.getValue()}</span>
          {c.row.original.company && <span className="block text-xs text-text-muted">{c.row.original.company}</span>}
        </span>
      ),
    },
    { accessorKey: "sources", header: "Source", enableSorting: false, cell: (c) => c.row.original.sources.map((s) => s.name).join(", ") || "—" },
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
    { accessorKey: "createdAt", header: "Created", cell: (c) => day(c.getValue<string>()) },
    { accessorKey: "status", header: "Status", enableSorting: false, cell: (c) => <LeadStatusBadge status={c.getValue()} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/sales-team" className="flex w-fit items-center gap-1 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Sales Team
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-semibold text-text-primary">{ex.name}</h1>
          <Badge variant={ex.status === "ACTIVE" ? "good" : "neutral"}>{ex.status === "ACTIVE" ? "Active" : ex.status}</Badge>
        </div>
        <p className="text-sm text-text-muted">
          {ex.designation} · {ex.employeeCode}
          {ex.state ? ` · ${ex.state}` : ""}
          {ex.managerName ? ` · reports to ${ex.managerName}` : ""}
          {ex.hireDate ? ` · joined ${day(ex.hireDate)}` : ""}
        </p>
        {(ex.email || ex.phone) && <p className="text-xs text-text-muted">{[ex.email, ex.phone].filter(Boolean).join(" · ")}</p>}
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <KpiCard label="Leads assigned" value={formatNumber(lead.total)} icon={Users} />
        <KpiCard label="Worked" value={formatNumber(lead.worked)} icon={PhoneCall} sub={`${formatPercent(rate("contact"))} · team ${formatPercent(teamRate("contact"))}`} />
        <KpiCard label="Not yet worked" value={formatNumber(lead.untouched)} icon={UserPlus} deltaTone={lead.untouched > 0 && lead.total > 0 && lead.untouched / lead.total > 0.25 ? "critical" : "neutral"} />
        <KpiCard label="Interested or better" value={formatNumber(lead.interested)} icon={ThumbsUp} sub={`${formatPercent(rate("interest"))} of worked · team ${formatPercent(teamRate("interest"))}`} />
        <KpiCard label="Won" value={formatNumber(lead.won)} icon={CheckCircle2} deltaTone="good" sub={`win rate ${formatPercent(rate("win"))} · team ${formatPercent(teamRate("win"))}`} />
        <KpiCard label="Lost" value={formatNumber(lead.lost)} icon={XCircle} deltaTone="critical" sub={`${formatPercent(rate("lost"))} of leads · team ${formatPercent(teamRate("lost"))}`} />
        <KpiCard label="Overdue follow-ups" value={formatNumber(lead.overdueFollowUps)} icon={AlertTriangle} deltaTone={lead.overdueFollowUps > 0 ? "critical" : "neutral"} sub={`${formatNumber(lead.upcomingFollowUps)} due in the next 7 days`} />
        <KpiCard label="Revenue" value={formatCurrency(revenue.revenue)} icon={IndianRupee} sub={`${formatNumber(revenue.orders)} orders`} />
        <KpiCard label="Target achievement" value={revenue.achievementPct == null ? "—" : formatPercent(revenue.achievementPct)} icon={Target} sub={revenue.targetRevenue ? `of ${formatCurrency(revenue.targetRevenue)}` : "no target set"} />
        <KpiCard label="Conversion (won ÷ assigned)" value={lead.total > 0 ? formatPercent((lead.won / lead.total) * 100) : "—"} icon={TrendingUp} />
      </div>

      {/* Where every lead stands + why they were lost */}
      <LeadOutcomesCard
        outcomes={data.outcomes}
        isLoading={false}
        onViewStage={(stage) => showLeads({ status: `stage:${stage}` })}
      />

      {/* vs the team */}
      <Card>
        <CardHeader>
          <CardTitle>Compared with the team</CardTitle>
          <CardDescription>Same measures, this executive versus all executives for the selected period. Green is better than the team.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="py-2 text-left font-medium">Measure</th>
                  <th className="py-2 text-right font-medium">{ex.name.split(" ")[0]}</th>
                  <th className="py-2 text-right font-medium">Team</th>
                  <th className="py-2 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {data.outcomes.rates.map((r) => {
                  const team = teamRate(r.key);
                  const diff = r.value != null && team != null ? r.value - team : null;
                  const good = diff == null ? null : LOWER_IS_BETTER.has(r.key) ? diff < 0 : diff > 0;
                  return (
                    <tr key={r.key} className="border-b border-border last:border-0" title={r.description}>
                      <td className="py-2 text-text-primary">{r.label}</td>
                      <td className="py-2 text-right tabular-nums">{formatPercent(r.value)}</td>
                      <td className="py-2 text-right tabular-nums text-text-muted">{formatPercent(team)}</td>
                      <td className={`py-2 text-right tabular-nums font-medium ${diff == null || Math.abs(diff) < 0.05 ? "text-text-muted" : good ? "text-good" : "text-critical"}`}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Which sources work for them */}
      <SourcePerformanceCard data={data.sources} isLoading={false} onViewSource={(sourceId) => showLeads({ source: sourceId })} />

      {/* Month by month */}
      <Card>
        <CardHeader>
          <CardTitle>Month by month</CardTitle>
          <CardDescription>Leads assigned, won and lost each month (last {data.monthly.length || 12} months in the range).</CardDescription>
        </CardHeader>
        <CardContent>
          {data.monthly.length === 0 ? (
            <EmptyState title="No lead activity in this period" />
          ) : (
            <div className="flex flex-col gap-2.5" data-testid="monthly-trend">
              {data.monthly.map((m) => (
                <div key={m.month} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-text-secondary">{monthLabel(m.month)}</span>
                  <div className="flex flex-col gap-1">
                    {(
                      [
                        ["assigned", m.assigned, "bg-accent"],
                        ["won", m.won, "bg-good"],
                        ["lost", m.lost, "bg-critical"],
                      ] as const
                    ).map(([key, value, tone]) => (
                      <div key={key} className="h-1.5 rounded-full bg-surface-2">
                        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value > 0 ? Math.max(1.5, (value / maxMonth) * 100) : 0}%` }} />
                      </div>
                    ))}
                  </div>
                  <span className="whitespace-nowrap tabular-nums text-text-muted">
                    <span className="text-text-primary">{formatNumber(m.assigned)}</span> assigned · <span className="text-good">{formatNumber(m.won)}</span> won ·{" "}
                    <span className="text-critical">{formatNumber(m.lost)}</span> lost
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Follow-ups */}
        <Card>
          <CardHeader>
            <CardTitle>Overdue follow-ups</CardTitle>
            <CardDescription>{lead.overdueFollowUps > 0 ? `${formatNumber(lead.overdueFollowUps)} open leads are past their follow-up date — oldest first.` : "Nothing is overdue."}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.overdueLeads.length === 0 ? (
              <EmptyState icon={Clock} title="No overdue follow-ups" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.overdueLeads.map((l) => (
                  <li key={l.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-surface-hover" onClick={() => openDrawer("lead", { id: l.id, name: l.name, company: l.company, leadCode: l.leadCode })}>
                      <span>
                        <span className="block font-medium text-text-primary">{l.name}</span>
                        <span className="block text-xs text-text-muted">{[l.company, l.statusName].filter(Boolean).join(" · ") || l.leadCode}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className="block font-medium text-critical">{l.daysOverdue}d overdue</span>
                        {l.estimatedValue != null && <span className="block text-text-muted">{formatCurrency(l.estimatedValue)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Orders + projects + documents */}
        <Card>
          <CardHeader>
            <CardTitle>Sales &amp; pipeline</CardTitle>
            <CardDescription>Orders booked, projects owned, and documents created by this executive.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatChip label="Revenue" value={formatRupees(revenue.revenue)} />
              <StatChip label="Orders" value={formatNumber(revenue.orders)} />
              <StatChip label="Avg order" value={revenue.avgOrderValue == null ? "—" : formatRupees(revenue.avgOrderValue)} />
              <StatChip label="Projects" value={formatNumber(projects.total)} />
              <StatChip label="Pipeline value" value={formatCurrency(projects.pipelineValue)} />
              <StatChip label="Quotations / invoices" value={`${documents.quotations.count} / ${documents.invoices.count}`} />
            </div>
            {data.recentOrders.length > 0 && (
              <div className="flex flex-col">
                <h4 className="mb-1 text-xs font-medium text-text-muted">Recent orders</h4>
                {data.recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between border-b border-border py-1.5 text-xs last:border-0">
                    <span className="text-text-primary">{o.orderCode} <span className="text-text-muted">· {day(o.orderDate)}</span></span>
                    <span className="text-text-primary">{formatRupees(o.totalAmount)}</span>
                  </div>
                ))}
              </div>
            )}
            {projects.byStage.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {projects.byStage.map((s) => (
                  <Badge key={s.stage} variant="neutral">
                    {s.stage.replace(/_/g, " ").toLowerCase()} {s.count}
                  </Badge>
                ))}
              </div>
            )}
            {revenue.orders === 0 && projects.total === 0 && <p className="text-xs text-text-muted">No orders or projects are attributed to this executive in the selected period.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Activity logged in this app</CardTitle>
          <CardDescription>Notes, emails and other actions this executive recorded here. Calls and notes made inside the CRM itself are not synced into this app.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.total === 0 ? (
            <EmptyState title="No activity recorded here yet" />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {activity.byType.map((a) => (
                  <Badge key={a.type} variant="accent">
                    {a.type.replace(/_/g, " ").toLowerCase()} {a.count}
                  </Badge>
                ))}
              </div>
              {activity.recent.map((a) => (
                <div key={a.id} className="border-b border-border pb-2 text-xs last:border-0">
                  <span className="font-medium text-text-primary">{a.leadName}</span>
                  <span className="text-text-muted"> · {a.type.replace(/_/g, " ").toLowerCase()} · {day(a.occurredAt)}</span>
                  {a.note && <p className="mt-0.5 text-text-secondary">{a.note}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Every lead they hold */}
      <div id="exec-leads" className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-text-primary">
          {ex.name}&apos;s leads
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by status"
            value={statusFilter ?? "ALL"}
            onChange={(e) => {
              setStatusFilter(e.target.value === "ALL" ? undefined : e.target.value);
              setPage(1);
            }}
            className="h-8 w-fit rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
          >
            <option value="ALL">All statuses</option>
            <option value="stage:LOST">All lost leads</option>
            <option value="stage:WON">All won leads</option>
            {(statusesQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by source"
            value={sourceFilter ?? "ALL"}
            onChange={(e) => {
              setSourceFilter(e.target.value === "ALL" ? undefined : e.target.value);
              setPage(1);
            }}
            className="h-8 w-fit rounded-sm border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
          >
            <option value="ALL">All sources</option>
            {data.sources.sources
              .filter((s) => s.sourceId)
              .map((s) => (
                <option key={s.sourceId} value={s.sourceId!}>
                  {s.source}
                </option>
              ))}
          </select>
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
          onRowClick={(row) => openDrawer("lead", row)}
          searchPlaceholder="Search this executive's leads by name, company or phone…"
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No leads match."
        />
      </div>
    </div>
  );
}

import { FunnelStage, LeadListItem, LeadsKpis, PaginatedResponse } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { LeadsView } from "@/components/leads/LeadsView";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [kpis, funnel, list] = await Promise.all([
    serverApiFetch<LeadsKpis>(appendDateRange("/api/leads/kpis", { dateFrom, dateTo })),
    serverApiFetch<FunnelStage[]>(appendDateRange("/api/leads/funnel", { dateFrom, dateTo })),
    serverApiFetch<PaginatedResponse<LeadListItem>>(appendDateRange("/api/leads?page=1&pageSize=10", { dateFrom, dateTo })),
  ]);

  return <LeadsView initialKpis={kpis} initialFunnel={funnel} initialList={list} />;
}

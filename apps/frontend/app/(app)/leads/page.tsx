import { FunnelStage, LeadListItem, LeadsKpis, PaginatedResponse } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { LeadsView } from "@/components/leads/LeadsView";

export default async function LeadsPage() {
  const [kpis, funnel, list] = await Promise.all([
    serverApiFetch<LeadsKpis>("/api/leads/kpis"),
    serverApiFetch<FunnelStage[]>("/api/leads/funnel"),
    serverApiFetch<PaginatedResponse<LeadListItem>>("/api/leads?page=1&pageSize=10"),
  ]);

  return <LeadsView initialKpis={kpis} initialFunnel={funnel} initialList={list} />;
}

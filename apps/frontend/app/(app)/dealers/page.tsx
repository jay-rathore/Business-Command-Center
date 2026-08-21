import { DealerListItem, DealersKpis, PaginatedResponse } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { DealersView } from "@/components/dealers/DealersView";

export default async function DealersPage() {
  const [kpis, list] = await Promise.all([
    serverApiFetch<DealersKpis>("/api/dealers/kpis"),
    serverApiFetch<PaginatedResponse<DealerListItem>>("/api/dealers?page=1&pageSize=10&sortDir=desc"),
  ]);

  return <DealersView initialKpis={kpis} initialList={list} />;
}

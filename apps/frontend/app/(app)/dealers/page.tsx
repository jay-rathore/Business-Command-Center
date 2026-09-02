import { DealerListItem, DealersKpis, PaginatedResponse } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { DealersView } from "@/components/dealers/DealersView";

export default async function DealersPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [kpis, list] = await Promise.all([
    serverApiFetch<DealersKpis>(appendDateRange("/api/dealers/kpis", { dateFrom, dateTo })),
    serverApiFetch<PaginatedResponse<DealerListItem>>(
      appendDateRange("/api/dealers?page=1&pageSize=10&sortDir=desc", { dateFrom, dateTo }),
    ),
  ]);

  return <DealersView initialKpis={kpis} initialList={list} />;
}

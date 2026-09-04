import { PaginatedResponse, SalesTeamExecutive, SalesTeamKpis } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { SalesTeamView } from "@/components/sales-team/SalesTeamView";

export default async function SalesTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [kpis, list] = await Promise.all([
    serverApiFetch<SalesTeamKpis>(appendDateRange("/api/sales-team/kpis", { dateFrom, dateTo })),
    serverApiFetch<PaginatedResponse<SalesTeamExecutive>>(
      appendDateRange("/api/sales-team?page=1&pageSize=10&sortBy=revenue&sortDir=desc", { dateFrom, dateTo }),
    ),
  ]);

  return <SalesTeamView initialKpis={kpis} initialList={list} />;
}

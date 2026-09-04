import { PaginatedResponse, ReferralPartnerKpis, ReferralPartnerListItem } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { BuildersView } from "@/components/builders/BuildersView";

export default async function BuildersPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [kpis, list] = await Promise.all([
    serverApiFetch<ReferralPartnerKpis>(appendDateRange("/api/builders/kpis", { dateFrom, dateTo })),
    serverApiFetch<PaginatedResponse<ReferralPartnerListItem>>(
      appendDateRange("/api/builders?page=1&pageSize=10&sortBy=projectValue&sortDir=desc", { dateFrom, dateTo }),
    ),
  ]);

  return <BuildersView initialKpis={kpis} initialList={list} />;
}

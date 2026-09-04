import { PaginatedResponse, ReferralPartnerKpis, ReferralPartnerListItem } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { ArchitectsView } from "@/components/architects/ArchitectsView";

export default async function ArchitectsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [kpis, list] = await Promise.all([
    serverApiFetch<ReferralPartnerKpis>(appendDateRange("/api/architects/kpis", { dateFrom, dateTo })),
    serverApiFetch<PaginatedResponse<ReferralPartnerListItem>>(
      appendDateRange("/api/architects?page=1&pageSize=10&sortBy=projectValue&sortDir=desc", { dateFrom, dateTo }),
    ),
  ]);

  return <ArchitectsView initialKpis={kpis} initialList={list} />;
}

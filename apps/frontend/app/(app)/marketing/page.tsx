import {
  CampaignListItem,
  ChannelBreakdownEntry,
  MarketingKpis,
  PaginatedResponse,
  SearchConsoleSummary,
  SiteAnalyticsSummary,
} from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { MarketingTabs } from "@/components/marketing/MarketingTabs";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [kpis, list, breakdown, siteAnalytics, searchConsole] = await Promise.all([
    serverApiFetch<MarketingKpis>(appendDateRange("/api/marketing/kpis", { dateFrom, dateTo })),
    serverApiFetch<PaginatedResponse<CampaignListItem>>(
      appendDateRange("/api/marketing?page=1&pageSize=10&sortDir=desc", { dateFrom, dateTo }),
    ),
    serverApiFetch<ChannelBreakdownEntry[]>(appendDateRange("/api/marketing/channel-breakdown", { dateFrom, dateTo })),
    serverApiFetch<SiteAnalyticsSummary>("/api/marketing/google-analytics-sync"),
    serverApiFetch<SearchConsoleSummary>("/api/marketing/search-console-sync"),
  ]);

  return (
    <MarketingTabs
      initialKpis={kpis}
      initialList={list}
      initialBreakdown={breakdown}
      initialSiteAnalytics={siteAnalytics}
      initialSearchConsole={searchConsole}
    />
  );
}

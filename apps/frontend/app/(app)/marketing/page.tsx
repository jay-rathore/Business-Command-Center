import {
  CampaignListItem,
  ChannelBreakdownEntry,
  MarketingKpis,
  PaginatedResponse,
  SearchConsoleSummary,
  SiteAnalyticsSummary,
} from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { MarketingTabs } from "@/components/marketing/MarketingTabs";

export default async function MarketingPage() {
  const [kpis, list, breakdown, siteAnalytics, searchConsole] = await Promise.all([
    serverApiFetch<MarketingKpis>("/api/marketing/kpis"),
    serverApiFetch<PaginatedResponse<CampaignListItem>>("/api/marketing?page=1&pageSize=10&sortDir=desc"),
    serverApiFetch<ChannelBreakdownEntry[]>("/api/marketing/channel-breakdown"),
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

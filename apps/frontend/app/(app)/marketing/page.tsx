import { CampaignListItem, ChannelBreakdownEntry, MarketingKpis, PaginatedResponse } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { MarketingView } from "@/components/marketing/MarketingView";

export default async function MarketingPage() {
  const [kpis, list, breakdown] = await Promise.all([
    serverApiFetch<MarketingKpis>("/api/marketing/kpis"),
    serverApiFetch<PaginatedResponse<CampaignListItem>>("/api/marketing?page=1&pageSize=10&sortDir=desc"),
    serverApiFetch<ChannelBreakdownEntry[]>("/api/marketing/channel-breakdown"),
  ]);

  return <MarketingView initialKpis={kpis} initialList={list} initialBreakdown={breakdown} />;
}

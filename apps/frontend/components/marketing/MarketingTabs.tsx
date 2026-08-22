"use client";

import { CampaignListItem, ChannelBreakdownEntry, MarketingKpis, PaginatedResponse, SearchConsoleSummary, SiteAnalyticsSummary } from "@hpl/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketingView } from "./MarketingView";
import { SiteAnalyticsView } from "./SiteAnalyticsView";

export function MarketingTabs({
  initialKpis,
  initialList,
  initialBreakdown,
  initialSiteAnalytics,
  initialSearchConsole,
}: {
  initialKpis: MarketingKpis | null;
  initialList: PaginatedResponse<CampaignListItem> | null;
  initialBreakdown: ChannelBreakdownEntry[] | null;
  initialSiteAnalytics: SiteAnalyticsSummary | null;
  initialSearchConsole: SearchConsoleSummary | null;
}) {
  return (
    <Tabs defaultValue="campaigns" className="flex flex-col gap-6">
      <TabsList className="w-fit">
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="site">Website & Search</TabsTrigger>
      </TabsList>
      <TabsContent value="campaigns">
        <MarketingView initialKpis={initialKpis} initialList={initialList} initialBreakdown={initialBreakdown} />
      </TabsContent>
      <TabsContent value="site">
        <SiteAnalyticsView initialSiteAnalytics={initialSiteAnalytics} initialSearchConsole={initialSearchConsole} />
      </TabsContent>
    </Tabs>
  );
}

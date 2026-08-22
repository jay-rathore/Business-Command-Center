import { Module } from "@nestjs/common";
import { MarketingController } from "./marketing.controller";
import { MarketingService } from "./marketing.service";
import { MetaAdsSyncController } from "./meta-ads-sync/meta-ads-sync.controller";
import { MetaAdsSyncService } from "./meta-ads-sync/meta-ads-sync.service";
import { GoogleAdsSyncController } from "./google-ads-sync/google-ads-sync.controller";
import { GoogleAdsSyncService } from "./google-ads-sync/google-ads-sync.service";
import { GoogleAnalyticsSyncController } from "./google-analytics-sync/google-analytics-sync.controller";
import { GoogleAnalyticsSyncService } from "./google-analytics-sync/google-analytics-sync.service";
import { SearchConsoleSyncController } from "./search-console-sync/search-console-sync.controller";
import { SearchConsoleSyncService } from "./search-console-sync/search-console-sync.service";

@Module({
  controllers: [
    MarketingController,
    MetaAdsSyncController,
    GoogleAdsSyncController,
    GoogleAnalyticsSyncController,
    SearchConsoleSyncController,
  ],
  providers: [MarketingService, MetaAdsSyncService, GoogleAdsSyncService, GoogleAnalyticsSyncService, SearchConsoleSyncService],
})
export class MarketingModule {}

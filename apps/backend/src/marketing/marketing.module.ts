import { Module } from "@nestjs/common";
import { MarketingController } from "./marketing.controller";
import { MarketingService } from "./marketing.service";
import { MetaAdsSyncController } from "./meta-ads-sync/meta-ads-sync.controller";
import { MetaAdsSyncService } from "./meta-ads-sync/meta-ads-sync.service";

@Module({
  controllers: [MarketingController, MetaAdsSyncController],
  providers: [MarketingService, MetaAdsSyncService],
})
export class MarketingModule {}

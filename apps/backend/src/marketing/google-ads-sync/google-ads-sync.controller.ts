import { Controller, Post } from "@nestjs/common";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { GoogleAdsSyncService } from "./google-ads-sync.service";

@Controller("marketing/google-ads-sync")
@RequirePermission("marketing:manage")
export class GoogleAdsSyncController {
  constructor(private readonly googleAdsSync: GoogleAdsSyncService) {}

  /** On-demand refresh from Google Ads, for testing or an out-of-band manual sync — the @Cron in
   * GoogleAdsSyncService already runs this every 6 hours. */
  @Post("run")
  run() {
    return this.googleAdsSync.syncNow();
  }
}

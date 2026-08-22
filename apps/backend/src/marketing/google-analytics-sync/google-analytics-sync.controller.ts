import { Controller, Get, Post } from "@nestjs/common";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { GoogleAnalyticsSyncService } from "./google-analytics-sync.service";

@Controller("marketing/google-analytics-sync")
export class GoogleAnalyticsSyncController {
  constructor(private readonly googleAnalyticsSync: GoogleAnalyticsSyncService) {}

  @Get()
  @RequirePermission("marketing:read")
  getSummary() {
    return this.googleAnalyticsSync.getSummary();
  }

  /** On-demand refresh from GA4, for testing or an out-of-band manual sync — the @Cron in
   * GoogleAnalyticsSyncService already runs this once a day. */
  @Post("run")
  @RequirePermission("marketing:manage")
  run() {
    return this.googleAnalyticsSync.syncNow();
  }
}

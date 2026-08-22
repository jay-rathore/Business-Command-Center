import { Controller, Get, Post } from "@nestjs/common";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { SearchConsoleSyncService } from "./search-console-sync.service";

@Controller("marketing/search-console-sync")
export class SearchConsoleSyncController {
  constructor(private readonly searchConsoleSync: SearchConsoleSyncService) {}

  @Get()
  @RequirePermission("marketing:read")
  getSummary() {
    return this.searchConsoleSync.getSummary();
  }

  /** On-demand refresh from Search Console, for testing or an out-of-band manual sync — the
   * @Cron in SearchConsoleSyncService already runs this once a day. */
  @Post("run")
  @RequirePermission("marketing:manage")
  run() {
    return this.searchConsoleSync.syncNow();
  }
}

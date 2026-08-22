import { Controller, Post } from "@nestjs/common";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { MetaAdsSyncService } from "./meta-ads-sync.service";

@Controller("marketing/meta-ads-sync")
@RequirePermission("marketing:manage")
export class MetaAdsSyncController {
  constructor(private readonly metaAdsSync: MetaAdsSyncService) {}

  /** On-demand refresh from Meta, for testing or an out-of-band manual sync — the @Cron in
   * MetaAdsSyncService already runs this every 6 hours. */
  @Post("run")
  run() {
    return this.metaAdsSync.syncNow();
  }
}

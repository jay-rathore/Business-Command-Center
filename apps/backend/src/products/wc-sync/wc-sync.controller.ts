import { Controller, Post } from "@nestjs/common";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { WcSyncService } from "./wc-sync.service";

@Controller("products/wc-sync")
@RequirePermission("products:manage")
export class WcSyncController {
  constructor(private readonly wcSync: WcSyncService) {}

  /** On-demand refresh from WooCommerce, for testing or an out-of-band manual sync — the
   * @Cron in WcSyncService already runs this on a daily schedule. */
  @Post("run")
  run() {
    return this.wcSync.syncNow();
  }
}

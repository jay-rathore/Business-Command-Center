import { Controller, Post, Query } from "@nestjs/common";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CrmSyncService } from "./crm-sync.service";

@Controller("leads/crm-sync")
@RequirePermission("leads:manage")
export class CrmSyncController {
  constructor(private readonly crmSync: CrmSyncService) {}

  /** On-demand refresh from the HPL CRM, for testing or an out-of-band manual sync — the
   * @Cron in CrmSyncService already runs this on a 30-minute schedule. */
  @Post("run")
  run(@Query("daysBack") daysBack?: string) {
    return this.crmSync.syncRecent(daysBack ? Number(daysBack) : undefined);
  }
}

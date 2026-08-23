import { BadRequestException, Controller, Post } from "@nestjs/common";
import { IntegrationProvider } from "@prisma/client";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { WooCommerceCredentials } from "../../integration-connections/credential-types";
import { WcSyncService } from "./wc-sync.service";

@Controller("products/wc-sync")
@RequirePermission("products:manage")
export class WcSyncController {
  constructor(
    private readonly wcSync: WcSyncService,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  /** On-demand refresh from WooCommerce, for testing or an out-of-band manual sync — the
   * @Cron in WcSyncService already runs this on a daily schedule for every tenant with an
   * active connection. This endpoint only syncs the current request's own organization. */
  @Post("run")
  async run(@CurrentUser("organizationId") organizationId: string) {
    const connection = await this.connections.findOne(organizationId, IntegrationProvider.WOOCOMMERCE);
    if (!connection) throw new BadRequestException("WooCommerce isn't configured for this organization yet");
    try {
      const result = await this.wcSync.syncNow(this.connections.decrypt<WooCommerceCredentials>(connection));
      await this.connections.recordSuccess(connection.id);
      return result;
    } catch (err) {
      await this.connections.recordError(connection.id, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}

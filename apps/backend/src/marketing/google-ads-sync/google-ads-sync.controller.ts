import { BadRequestException, Controller, Post } from "@nestjs/common";
import { IntegrationProvider } from "@prisma/client";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { GoogleAdsCredentials } from "../../integration-connections/credential-types";
import { GoogleAdsSyncService } from "./google-ads-sync.service";

@Controller("marketing/google-ads-sync")
@RequirePermission("marketing:manage")
export class GoogleAdsSyncController {
  constructor(
    private readonly googleAdsSync: GoogleAdsSyncService,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  /** On-demand refresh from Google Ads, for testing or an out-of-band manual sync — the @Cron
   * in GoogleAdsSyncService already runs this every 6 hours for every tenant with an active
   * connection. This endpoint only syncs the current request's own organization. */
  @Post("run")
  async run(@CurrentUser("organizationId") organizationId: string) {
    const connection = await this.connections.findOne(organizationId, IntegrationProvider.GOOGLE_ADS);
    if (!connection) throw new BadRequestException("Google Ads isn't configured for this organization yet");
    try {
      const result = await this.googleAdsSync.syncNow(this.connections.decrypt<GoogleAdsCredentials>(connection));
      await this.connections.recordSuccess(connection.id);
      return result;
    } catch (err) {
      await this.connections.recordError(connection.id, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}

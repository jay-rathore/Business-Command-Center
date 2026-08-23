import { BadRequestException, Controller, Get, Post } from "@nestjs/common";
import { IntegrationProvider } from "@prisma/client";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { GoogleAnalyticsCredentials } from "../../integration-connections/credential-types";
import { GoogleAnalyticsSyncService } from "./google-analytics-sync.service";

@Controller("marketing/google-analytics-sync")
export class GoogleAnalyticsSyncController {
  constructor(
    private readonly googleAnalyticsSync: GoogleAnalyticsSyncService,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  @Get()
  @RequirePermission("marketing:read")
  getSummary() {
    return this.googleAnalyticsSync.getSummary();
  }

  /** On-demand refresh from GA4, for testing or an out-of-band manual sync — the @Cron in
   * GoogleAnalyticsSyncService already runs this once a day for every tenant with an active
   * connection. This endpoint only syncs the current request's own organization. */
  @Post("run")
  @RequirePermission("marketing:manage")
  async run(@CurrentUser("organizationId") organizationId: string) {
    const connection = await this.connections.findOne(organizationId, IntegrationProvider.GOOGLE_ANALYTICS);
    if (!connection) throw new BadRequestException("Google Analytics isn't configured for this organization yet");
    try {
      const result = await this.googleAnalyticsSync.syncNow(this.connections.decrypt<GoogleAnalyticsCredentials>(connection));
      await this.connections.recordSuccess(connection.id);
      return result;
    } catch (err) {
      await this.connections.recordError(connection.id, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}

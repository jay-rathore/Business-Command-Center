import { BadGatewayException, BadRequestException, Controller, Get, Post } from "@nestjs/common";
import { IntegrationProvider } from "@prisma/client";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { SearchConsoleCredentials } from "../../integration-connections/credential-types";
import { SearchConsoleSyncService } from "./search-console-sync.service";

@Controller("marketing/search-console-sync")
export class SearchConsoleSyncController {
  constructor(
    private readonly searchConsoleSync: SearchConsoleSyncService,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  @Get()
  @RequirePermission("marketing:read")
  getSummary() {
    return this.searchConsoleSync.getSummary();
  }

  /** On-demand refresh from Search Console, for testing or an out-of-band manual sync — the
   * @Cron in SearchConsoleSyncService already runs this once a day for every tenant with an
   * active connection. This endpoint only syncs the current request's own organization. */
  @Post("run")
  @RequirePermission("marketing:manage")
  async run(@CurrentUser("organizationId") organizationId: string) {
    const connection = await this.connections.findOne(organizationId, IntegrationProvider.SEARCH_CONSOLE);
    if (!connection) throw new BadRequestException("Search Console isn't configured for this organization yet");
    try {
      const result = await this.searchConsoleSync.syncNow(this.connections.decrypt<SearchConsoleCredentials>(connection));
      await this.connections.recordSuccess(connection.id);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.connections.recordError(connection.id, message);
      // 502, not a bare 500: the failure is the upstream provider's (expired token, outage), and the reason is useful to the operator.
      throw new BadGatewayException(`Search Console sync failed: ${message}`);
    }
  }
}

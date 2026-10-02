import { BadGatewayException, BadRequestException, Controller, Post, Query } from "@nestjs/common";
import { IntegrationProvider } from "@prisma/client";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { HplCrmCredentials } from "../../integration-connections/credential-types";
import { CrmSyncService } from "./crm-sync.service";

@Controller("leads/crm-sync")
@RequirePermission("leads:manage")
export class CrmSyncController {
  constructor(
    private readonly crmSync: CrmSyncService,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  /** On-demand refresh from the HPL CRM, for testing or an out-of-band manual sync — the
   * @Cron in CrmSyncService already runs the recent-window sync every 30 minutes for every
   * tenant with an active connection. This endpoint only syncs the current request's own
   * organization. Pass `?full=true` for a full walk of every CRM page (no date filter) instead
   * of the normal recent-window sync — see CrmSyncService's class doc for when that's needed. */
  @Post("run")
  async run(@CurrentUser("organizationId") organizationId: string, @Query("daysBack") daysBack?: string, @Query("full") full?: string) {
    const connection = await this.connections.findOne(organizationId, IntegrationProvider.HPL_CRM);
    if (!connection) throw new BadRequestException("HPL CRM isn't configured for this organization yet");

    try {
      const credentials = this.connections.decrypt<HplCrmCredentials>(connection);
      const result =
        full === "true"
          ? await this.crmSync.fullResync(credentials)
          : await this.crmSync.syncRecent(credentials, daysBack ? Number(daysBack) : undefined);
      await this.connections.recordSuccess(connection.id);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.connections.recordError(connection.id, message);
      // 502, not a bare 500: the failure is the upstream provider's (expired token, outage), and the reason is useful to the operator.
      throw new BadGatewayException(`CRM sync failed: ${message}`);
    }
  }
}

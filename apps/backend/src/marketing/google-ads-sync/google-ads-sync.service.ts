import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { GoogleAdsApi } from "google-ads-api";
import { CampaignStatus, IntegrationProvider } from "@prisma/client";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";
import { TenantContext } from "../../common/context/tenant-context";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { GoogleAdsCredentials } from "../../integration-connections/credential-types";

const LIFETIME_FROM_DATE = "2015-01-01"; // arbitrary floor well before any real campaign, mirrors Meta's date_preset=maximum

interface GoogleCampaignRow {
  campaign: { id: string; name: string; status: string; startDateTime?: string | null; endDateTime?: string | null };
  metrics: { costMicros?: string | number; conversions?: number };
}

export interface GoogleAdsSyncResult {
  processed: number;
  created: number;
  updated: number;
}

function mapCampaignStatus(status: string): CampaignStatus {
  if (status === "ENABLED") return "ACTIVE";
  if (status === "PAUSED") return "PAUSED";
  return "ENDED";
}

/** Pulls real campaign spend + conversion counts from each tenant's own live Google Ads
 * account (credentials: IntegrationConnection, provider GOOGLE_ADS), additively upserting by
 * googleCampaignId — mirrors MetaAdsSyncService (../meta-ads-sync/meta-ads-sync.service.ts).
 * Uses a wide fixed date range (lifetime-style totals) since `spend`/`leadsCount` are cumulative
 * cached columns, not a rolling window. revenue is intentionally never touched here — see the
 * "never fabricate revenue against real spend" note in marketing.service.ts. */
@Injectable()
export class GoogleAdsSyncService {
  private readonly logger = new Logger(GoogleAdsSyncService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync(): Promise<void> {
    const active = await this.connections.listActive(IntegrationProvider.GOOGLE_ADS);
    for (const connection of active) {
      await TenantContext.run({ organizationId: connection.organizationId }, async () => {
        try {
          const credentials = this.connections.decrypt<GoogleAdsCredentials>(connection);
          const result = await this.syncNow(credentials);
          await this.connections.recordSuccess(connection.id);
          this.logger.log(
            `Google Ads sync (org ${connection.organizationId}): ${result.processed} campaigns processed (${result.created} new, ${result.updated} updated)`,
          );
        } catch (err) {
          await this.connections.recordError(connection.id, this.errorMessage(err));
          this.logError(connection.organizationId, err);
        }
      });
    }
  }

  async syncNow(credentials: GoogleAdsCredentials): Promise<GoogleAdsSyncResult> {
    const customer = this.getCustomer(credentials);
    const toDate = new Date().toISOString().slice(0, 10);

    const rows = (await customer.report({
      entity: "campaign",
      attributes: ["campaign.id", "campaign.name", "campaign.status", "campaign.start_date_time", "campaign.end_date_time"],
      metrics: ["metrics.cost_micros", "metrics.conversions"],
      from_date: LIFETIME_FROM_DATE,
      to_date: toDate,
    })) as unknown as GoogleCampaignRow[];

    const organizationId = TenantContext.get().organizationId;
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const spend = Number(row.metrics.costMicros ?? 0) / 1_000_000;
      const leadsCount = Math.round(Number(row.metrics.conversions ?? 0));
      const googleCampaignId = String(row.campaign.id);

      const existing = await this.prisma.marketingCampaign.findUnique({
        where: { organizationId_googleCampaignId: { organizationId, googleCampaignId } },
        select: { id: true },
      });

      await this.prisma.marketingCampaign.upsert({
        where: { organizationId_googleCampaignId: { organizationId, googleCampaignId } },
        update: {
          name: row.campaign.name,
          status: mapCampaignStatus(row.campaign.status),
          spend,
          leadsCount,
          endDate: row.campaign.endDateTime ? new Date(row.campaign.endDateTime) : null,
        },
        create: {
          organizationId,
          googleCampaignId,
          name: row.campaign.name,
          platform: "GOOGLE_ADS",
          status: mapCampaignStatus(row.campaign.status),
          spend,
          leadsCount,
          startDate: row.campaign.startDateTime ? new Date(row.campaign.startDateTime) : new Date(),
          endDate: row.campaign.endDateTime ? new Date(row.campaign.endDateTime) : null,
        },
      });

      if (existing) updated++;
      else created++;
    }

    return { processed: rows.length, created, updated };
  }

  // Deliberately not cached on the instance — this is a singleton provider shared across every
  // tenant's requests, and each tenant now has its own client_id/client_secret/developer_token.
  private getCustomer(credentials: GoogleAdsCredentials) {
    const client = new GoogleAdsApi({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      developer_token: credentials.developerToken,
    });
    return client.Customer({
      customer_id: credentials.customerId,
      login_customer_id: credentials.loginCustomerId,
      refresh_token: credentials.refreshToken,
    });
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private logError(organizationId: string, err: unknown): void {
    const message = this.errorMessage(err);
    if (message.includes("UNAUTHENTICATED") || message.includes("invalid_grant") || message.includes("PERMISSION_DENIED")) {
      this.logger.error(
        `Google Ads sync failed (org ${organizationId}) — credentials likely invalid or expired. Re-check this ` +
          `tenant's Google Ads connection in Settings. Original error: ${message}`,
      );
      return;
    }
    this.logger.error(`Google Ads sync failed (org ${organizationId}): ${message}`);
  }
}

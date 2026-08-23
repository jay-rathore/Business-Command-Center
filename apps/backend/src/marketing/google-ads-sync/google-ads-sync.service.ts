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

// The google-ads-api library returns raw GAQL field names (snake_case, not camelCase) and
// enum fields (like campaign.status) as their raw numeric value, not a string label — confirmed
// by logging a real response. CampaignStatusEnum.CampaignStatus: 2=ENABLED, 3=PAUSED, 4=REMOVED.
interface GoogleCampaignRow {
  campaign: {
    id: string;
    name: string;
    status: number;
    start_date_time?: string | null;
    end_date_time?: string | null;
    bidding_strategy_type?: number;
  };
  campaign_budget?: { amount_micros?: string | number | null } | null;
  metrics: {
    cost_micros?: string | number;
    conversions?: number;
    impressions?: string | number;
    clicks?: string | number;
    average_cpc?: string | number;
    ctr?: number;
  };
}

export interface GoogleAdsSyncResult {
  processed: number;
  created: number;
  updated: number;
}

const GOOGLE_CAMPAIGN_STATUS_ENABLED = 2;
const GOOGLE_CAMPAIGN_STATUS_PAUSED = 3;

function mapCampaignStatus(status: number): CampaignStatus {
  if (status === GOOGLE_CAMPAIGN_STATUS_ENABLED) return "ACTIVE";
  if (status === GOOGLE_CAMPAIGN_STATUS_PAUSED) return "PAUSED";
  return "ENDED"; // REMOVED (4), UNKNOWN (1), or UNSPECIFIED (0)
}

// BiddingStrategyTypeEnum.BiddingStrategyType — google-ads-api/build/src/protos/autogen/enums.d.ts
const BIDDING_STRATEGY_LABELS: Record<number, string> = {
  2: "Enhanced CPC",
  3: "Manual CPC",
  4: "Manual CPM",
  5: "Page One Promoted",
  6: "Target CPA",
  7: "Target Outrank Share",
  8: "Target ROAS",
  9: "Target Spend",
  10: "Maximize Conversions",
  11: "Maximize Conversion Value",
  12: "Percent CPC",
  13: "Manual CPV",
  14: "Target CPM",
  15: "Target Impression Share",
  16: "Commission",
  18: "Manual CPA",
  19: "Fixed CPM",
  20: "Target CPV",
  21: "Target CPC",
  22: "Fixed Share of Voice",
};

function mapBiddingStrategy(status: number | undefined): string | null {
  if (status == null) return null;
  return BIDDING_STRATEGY_LABELS[status] ?? null; // UNSPECIFIED (0), UNKNOWN (1), INVALID (17) fall through to null
}

// Google's date_time fields come back as "YYYY-MM-DD HH:mm:ss" (space-separated, no "T" or
// timezone) — new Date(...) on that literal string parses inconsistently across engines, so
// normalize to ISO-8601 first.
function parseGoogleDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const isoLike = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
      attributes: [
        "campaign.id",
        "campaign.name",
        "campaign.status",
        "campaign.start_date_time",
        "campaign.end_date_time",
        "campaign.bidding_strategy_type",
        "campaign_budget.amount_micros",
      ],
      metrics: ["metrics.cost_micros", "metrics.conversions", "metrics.impressions", "metrics.clicks", "metrics.average_cpc", "metrics.ctr"],
      from_date: LIFETIME_FROM_DATE,
      to_date: toDate,
    })) as unknown as GoogleCampaignRow[];

    const organizationId = TenantContext.get().organizationId;
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const spend = Number(row.metrics.cost_micros ?? 0) / 1_000_000;
      const leadsCount = Math.round(Number(row.metrics.conversions ?? 0));
      const impressions = Math.round(Number(row.metrics.impressions ?? 0));
      const clicks = Math.round(Number(row.metrics.clicks ?? 0));
      const avgCpc = Number(row.metrics.average_cpc ?? 0) / 1_000_000;
      const ctr = Number(row.metrics.ctr ?? 0) * 100; // API returns a 0-1 fraction, we store a percentage
      const dailyBudget = row.campaign_budget?.amount_micros != null ? Number(row.campaign_budget.amount_micros) / 1_000_000 : null;
      const bidStrategy = mapBiddingStrategy(row.campaign.bidding_strategy_type);
      const googleCampaignId = String(row.campaign.id);
      const endDate = parseGoogleDateTime(row.campaign.end_date_time);

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
          impressions,
          clicks,
          ctr,
          avgCpc,
          dailyBudget,
          bidStrategy,
          endDate,
        },
        create: {
          organizationId,
          googleCampaignId,
          name: row.campaign.name,
          platform: "GOOGLE_ADS",
          status: mapCampaignStatus(row.campaign.status),
          spend,
          leadsCount,
          impressions,
          clicks,
          ctr,
          avgCpc,
          dailyBudget,
          bidStrategy,
          startDate: parseGoogleDateTime(row.campaign.start_date_time) ?? new Date(),
          endDate,
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

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { GoogleAdsApi } from "google-ads-api";
import { CampaignStatus } from "@prisma/client";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";

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

/** Pulls real campaign spend + conversion counts from the live Google Ads account, additively
 * upserting by googleCampaignId — mirrors MetaAdsSyncService (../meta-ads-sync/meta-ads-sync.service.ts).
 * Uses a wide fixed date range (lifetime-style totals) since `spend`/`leadsCount` are cumulative
 * cached columns, not a rolling window. revenue is intentionally never touched here — see the
 * "never fabricate revenue against real spend" note in marketing.service.ts. */
@Injectable()
export class GoogleAdsSyncService {
  private readonly logger = new Logger(GoogleAdsSyncService.name);
  private client: GoogleAdsApi | null = null;

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync(): Promise<void> {
    try {
      const result = await this.syncNow();
      this.logger.log(`Google Ads sync: ${result.processed} campaigns processed (${result.created} new, ${result.updated} updated)`);
    } catch (err) {
      this.logError(err);
    }
  }

  async syncNow(): Promise<GoogleAdsSyncResult> {
    const customer = this.getCustomer();
    const toDate = new Date().toISOString().slice(0, 10);

    const rows = (await customer.report({
      entity: "campaign",
      attributes: ["campaign.id", "campaign.name", "campaign.status", "campaign.start_date_time", "campaign.end_date_time"],
      metrics: ["metrics.cost_micros", "metrics.conversions"],
      from_date: LIFETIME_FROM_DATE,
      to_date: toDate,
    })) as unknown as GoogleCampaignRow[];

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const spend = Number(row.metrics.costMicros ?? 0) / 1_000_000;
      const leadsCount = Math.round(Number(row.metrics.conversions ?? 0));
      const googleCampaignId = String(row.campaign.id);

      const existing = await this.prisma.marketingCampaign.findUnique({ where: { googleCampaignId }, select: { id: true } });

      await this.prisma.marketingCampaign.upsert({
        where: { googleCampaignId },
        update: {
          name: row.campaign.name,
          status: mapCampaignStatus(row.campaign.status),
          spend,
          leadsCount,
          endDate: row.campaign.endDateTime ? new Date(row.campaign.endDateTime) : null,
        },
        create: {
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

  private getCustomer() {
    if (!this.client) {
      this.client = new GoogleAdsApi({
        client_id: this.config.getOrThrow<string>("GOOGLE_ADS_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("GOOGLE_ADS_CLIENT_SECRET"),
        developer_token: this.config.getOrThrow<string>("GOOGLE_ADS_DEVELOPER_TOKEN"),
      });
    }

    return this.client.Customer({
      customer_id: this.config.getOrThrow<string>("GOOGLE_ADS_CUSTOMER_ID"),
      login_customer_id: this.config.get<string>("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
      refresh_token: this.config.getOrThrow<string>("GOOGLE_ADS_REFRESH_TOKEN"),
    });
  }

  private logError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNAUTHENTICATED") || message.includes("invalid_grant") || message.includes("PERMISSION_DENIED")) {
      this.logger.error(
        `Google Ads sync failed — credentials likely invalid or expired. Re-check GOOGLE_ADS_REFRESH_TOKEN / ` +
          `GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_CUSTOMER_ID in .env. Original error: ${message}`,
      );
      return;
    }
    this.logger.error(`Google Ads sync failed: ${message}`);
  }
}

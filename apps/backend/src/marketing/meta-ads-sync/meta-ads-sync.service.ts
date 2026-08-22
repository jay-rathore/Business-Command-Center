import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CampaignStatus } from "@prisma/client";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";

const GRAPH_API_VERSION = "v21.0";

interface MetaCampaignRaw {
  id: string;
  name: string;
  effective_status: string;
  start_time?: string;
  stop_time?: string;
}

interface MetaInsightAction {
  action_type: string;
  value: string;
}

interface MetaInsightRaw {
  campaign_id: string;
  spend?: string;
  actions?: MetaInsightAction[];
}

export interface MetaAdsSyncResult {
  processed: number;
  created: number;
  updated: number;
}

function mapEffectiveStatus(status: string): CampaignStatus {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "PAUSED") return "PAUSED";
  return "ENDED";
}

/** Pulls real campaign spend + lead counts from HPL Maker's live Meta Ads account, additively
 * upserting by metaCampaignId — mirrors WcSyncService (../../products/wc-sync/wc-sync.service.ts).
 * Uses date_preset=maximum (lifetime totals) since `spend`/`leadsCount` are cumulative cached
 * columns, not a rolling window. revenue is intentionally never touched here — see the "never
 * fabricate revenue against real spend" note in marketing.service.ts. */
@Injectable()
export class MetaAdsSyncService {
  private readonly logger = new Logger(MetaAdsSyncService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync(): Promise<void> {
    try {
      const result = await this.syncNow();
      this.logger.log(`Meta Ads sync: ${result.processed} campaigns processed (${result.created} new, ${result.updated} updated)`);
    } catch (err) {
      this.logError(err);
    }
  }

  async syncNow(): Promise<MetaAdsSyncResult> {
    const accountId = this.config.getOrThrow<string>("META_AD_ACCOUNT_ID");
    const token = this.config.getOrThrow<string>("META_ACCESS_TOKEN");
    const base = `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${accountId}`;

    const [campaignsRes, insightsRes] = await Promise.all([
      fetch(`${base}/campaigns?fields=name,effective_status,start_time,stop_time&access_token=${token}`),
      fetch(`${base}/insights?fields=campaign_id,spend,actions&level=campaign&date_preset=maximum&access_token=${token}`),
    ]);

    if (!campaignsRes.ok) throw new Error(`Meta campaigns API returned ${campaignsRes.status}: ${await campaignsRes.text()}`);
    if (!insightsRes.ok) throw new Error(`Meta insights API returned ${insightsRes.status}: ${await insightsRes.text()}`);

    const campaigns = ((await campaignsRes.json()) as { data: MetaCampaignRaw[] }).data;
    const insights = ((await insightsRes.json()) as { data: MetaInsightRaw[] }).data;
    const insightsByCampaign = new Map(insights.map((i) => [i.campaign_id, i]));

    let created = 0;
    let updated = 0;

    for (const raw of campaigns) {
      const insight = insightsByCampaign.get(raw.id);
      const spend = Number(insight?.spend ?? 0);
      const leadsCount = Number(insight?.actions?.find((a) => a.action_type === "lead")?.value ?? 0);

      const existing = await this.prisma.marketingCampaign.findUnique({ where: { metaCampaignId: raw.id }, select: { id: true } });

      await this.prisma.marketingCampaign.upsert({
        where: { metaCampaignId: raw.id },
        update: {
          name: raw.name,
          status: mapEffectiveStatus(raw.effective_status),
          spend,
          leadsCount,
          endDate: raw.stop_time ? new Date(raw.stop_time) : null,
        },
        create: {
          metaCampaignId: raw.id,
          name: raw.name,
          platform: "META_ADS",
          status: mapEffectiveStatus(raw.effective_status),
          spend,
          leadsCount,
          startDate: raw.start_time ? new Date(raw.start_time) : new Date(),
          endDate: raw.stop_time ? new Date(raw.stop_time) : null,
        },
      });

      if (existing) updated++;
      else created++;
    }

    return { processed: campaigns.length, created, updated };
  }

  private logError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("OAuthException") || message.includes('"code":190') || message.includes(" 401")) {
      this.logger.error(
        `Meta Ads sync failed — access token likely expired. Generate a new one via Graph API Explorer ` +
          `+ Access Token Debugger ("Extend Access Token") and update META_ACCESS_TOKEN in .env. Original error: ${message}`,
      );
      return;
    }
    this.logger.error(`Meta Ads sync failed: ${message}`);
  }
}

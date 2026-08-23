import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignStatus, IntegrationProvider } from '@prisma/client';
import { PRISMA_EXTENDED_CLIENT } from '../../prisma/prisma-extended.provider';
import type { ExtendedPrismaClient } from '../../prisma/prisma-extended.provider';
import { TenantContext } from '../../common/context/tenant-context';
import { IntegrationConnectionsService } from '../../integration-connections/integration-connections.service';
import type { MetaAdsCredentials } from '../../integration-connections/credential-types';
import { CampaignEventService } from '../campaign-events/campaign-event.service';

const GRAPH_API_VERSION = 'v21.0';
const DAILY_METRICS_LOOKBACK_DAYS = 60;

interface MetaCampaignRaw {
  id: string;
  name: string;
  effective_status: string;
  start_time?: string;
  stop_time?: string;
  bid_strategy?: string;
}

interface MetaInsightAction {
  action_type: string;
  value: string;
}

interface MetaInsightRaw {
  campaign_id: string;
  spend?: string;
  actions?: MetaInsightAction[];
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
}

interface MetaDailyInsightRaw extends MetaInsightRaw {
  date_start: string; // "YYYY-MM-DD"
}

// e.g. "LOWEST_COST_WITHOUT_CAP" -> "Lowest cost without cap"
function formatBidStrategy(raw: string | undefined): string | null {
  if (!raw) return null;
  const words = raw.toLowerCase().split('_');
  return (
    words[0].charAt(0).toUpperCase() +
    words[0].slice(1) +
    (words.length > 1 ? ' ' + words.slice(1).join(' ') : '')
  );
}

export interface MetaAdsSyncResult {
  processed: number;
  created: number;
  updated: number;
}

function mapEffectiveStatus(status: string): CampaignStatus {
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'PAUSED') return 'PAUSED';
  return 'ENDED';
}

/** Pulls real campaign spend + lead counts from each tenant's own live Meta Ads account
 * (credentials: IntegrationConnection, provider META_ADS — see
 * integration-connections.service.ts), additively upserting by metaCampaignId — mirrors
 * WcSyncService (../../products/wc-sync/wc-sync.service.ts). Uses date_preset=maximum
 * (lifetime totals) since `spend`/`leadsCount` are cumulative cached columns, not a rolling
 * window. revenue is intentionally never touched here — see the "never fabricate revenue
 * against real spend" note in marketing.service.ts. */
@Injectable()
export class MetaAdsSyncService {
  private readonly logger = new Logger(MetaAdsSyncService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT)
    private readonly prisma: ExtendedPrismaClient,
    private readonly connections: IntegrationConnectionsService,
    private readonly campaignEvents: CampaignEventService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledSync(): Promise<void> {
    const active = await this.connections.listActive(
      IntegrationProvider.META_ADS,
    );
    for (const connection of active) {
      await TenantContext.run(
        { organizationId: connection.organizationId },
        async () => {
          try {
            const credentials =
              this.connections.decrypt<MetaAdsCredentials>(connection);
            const result = await this.syncNow(credentials);
            await this.connections.recordSuccess(connection.id);
            this.logger.log(
              `Meta Ads sync (org ${connection.organizationId}): ${result.processed} campaigns processed (${result.created} new, ${result.updated} updated)`,
            );
          } catch (err) {
            await this.connections.recordError(
              connection.id,
              this.errorMessage(err),
            );
            this.logError(connection.organizationId, err);
          }
        },
      );
    }
  }

  async syncNow(credentials: MetaAdsCredentials): Promise<MetaAdsSyncResult> {
    const { adAccountId, accessToken } = credentials;
    const base = `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${adAccountId}`;

    const [campaignsRes, insightsRes] = await Promise.all([
      fetch(
        `${base}/campaigns?fields=name,effective_status,start_time,stop_time,bid_strategy&access_token=${accessToken}`,
      ),
      fetch(
        `${base}/insights?fields=campaign_id,spend,actions,impressions,clicks,ctr,cpc&level=campaign&date_preset=maximum&access_token=${accessToken}`,
      ),
    ]);

    if (!campaignsRes.ok)
      throw new Error(
        `Meta campaigns API returned ${campaignsRes.status}: ${await campaignsRes.text()}`,
      );
    if (!insightsRes.ok)
      throw new Error(
        `Meta insights API returned ${insightsRes.status}: ${await insightsRes.text()}`,
      );

    const campaigns = (
      (await campaignsRes.json()) as { data: MetaCampaignRaw[] }
    ).data;
    const insights = ((await insightsRes.json()) as { data: MetaInsightRaw[] })
      .data;
    const insightsByCampaign = new Map(insights.map((i) => [i.campaign_id, i]));

    const organizationId = TenantContext.get().organizationId;
    let created = 0;
    let updated = 0;
    const campaignIdByMetaId = new Map<string, string>();

    for (const raw of campaigns) {
      const insight = insightsByCampaign.get(raw.id);
      const spend = Number(insight?.spend ?? 0);
      const leadsCount = Number(
        insight?.actions?.find((a) => a.action_type === 'lead')?.value ?? 0,
      );
      const impressions = Math.round(Number(insight?.impressions ?? 0));
      const clicks = Math.round(Number(insight?.clicks ?? 0));
      const ctr = Number(insight?.ctr ?? 0); // Meta already returns this as a percentage, not a fraction
      const avgCpc = Number(insight?.cpc ?? 0);
      const bidStrategy = formatBidStrategy(raw.bid_strategy);
      const status = mapEffectiveStatus(raw.effective_status);

      const existing = await this.prisma.marketingCampaign.findUnique({
        where: {
          organizationId_metaCampaignId: {
            organizationId,
            metaCampaignId: raw.id,
          },
        },
        select: { id: true, status: true, name: true },
      });

      const campaignRow = await this.prisma.marketingCampaign.upsert({
        where: {
          organizationId_metaCampaignId: {
            organizationId,
            metaCampaignId: raw.id,
          },
        },
        update: {
          name: raw.name,
          status,
          spend,
          leadsCount,
          impressions,
          clicks,
          ctr,
          avgCpc,
          bidStrategy,
          endDate: raw.stop_time ? new Date(raw.stop_time) : null,
        },
        create: {
          organizationId,
          metaCampaignId: raw.id,
          name: raw.name,
          platform: 'META_ADS',
          status,
          spend,
          leadsCount,
          impressions,
          clicks,
          ctr,
          avgCpc,
          bidStrategy,
          startDate: raw.start_time ? new Date(raw.start_time) : new Date(),
          endDate: raw.stop_time ? new Date(raw.stop_time) : null,
        },
        select: { id: true },
      });

      campaignIdByMetaId.set(raw.id, campaignRow.id);

      await this.campaignEvents.recordChanges(
        organizationId,
        campaignRow.id,
        existing
          ? { status: existing.status, dailyBudget: null, name: existing.name }
          : null,
        { status, dailyBudget: null, name: raw.name },
      );

      if (existing) updated++;
      else created++;
    }

    try {
      await this.syncDailyMetrics(
        base,
        accessToken,
        organizationId,
        campaignIdByMetaId,
      );
    } catch (err) {
      // Non-fatal: lifetime campaign totals above already synced successfully. Daily metrics only
      // feed Traffic Intelligence's root-cause engine, not the main campaign list/KPIs.
      this.logger.error(
        `Meta daily insights sync failed (org ${organizationId}): ${this.errorMessage(err)}`,
      );
    }

    return { processed: campaigns.length, created, updated };
  }

  /** Pulls a day-segmented insights report (trailing DAILY_METRICS_LOOKBACK_DAYS) alongside the
   * lifetime aggregate above, upserting AdPlatformDailyMetric — this is what lets the Traffic
   * Intelligence root-cause engine correlate "campaign X spent/clicked N on day Y" against that
   * day's website traffic, which the lifetime-cumulative fields on MarketingCampaign can't do. */
  private async syncDailyMetrics(
    base: string,
    accessToken: string,
    organizationId: string,
    campaignIdByMetaId: Map<string, string>,
  ): Promise<void> {
    if (campaignIdByMetaId.size === 0) return;

    const until = new Date().toISOString().slice(0, 10);
    const since = new Date(
      Date.now() - DAILY_METRICS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);
    const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

    const res = await fetch(
      `${base}/insights?fields=campaign_id,spend,actions,impressions,clicks,ctr,cpc&level=campaign&time_range=${timeRange}&time_increment=1&access_token=${accessToken}`,
    );
    if (!res.ok)
      throw new Error(
        `Meta daily insights API returned ${res.status}: ${await res.text()}`,
      );

    const rows = ((await res.json()) as { data: MetaDailyInsightRaw[] }).data;

    for (const row of rows) {
      const campaignId = campaignIdByMetaId.get(row.campaign_id);
      if (!campaignId) continue; // campaign not in this sync's active set (e.g. deleted since)

      const data = {
        spend: Number(row.spend ?? 0),
        impressions: Math.round(Number(row.impressions ?? 0)),
        clicks: Math.round(Number(row.clicks ?? 0)),
        conversions: Number(
          row.actions?.find((a) => a.action_type === 'lead')?.value ?? 0,
        ),
        ctr: Number(row.ctr ?? 0),
        avgCpc: Number(row.cpc ?? 0),
      };
      const date = new Date(row.date_start);

      await this.prisma.adPlatformDailyMetric.upsert({
        where: {
          organizationId_campaignId_date: { organizationId, campaignId, date },
        },
        update: data,
        create: {
          organizationId,
          campaignId,
          platform: 'META_ADS',
          date,
          ...data,
        },
      });
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private logError(organizationId: string, err: unknown): void {
    const message = this.errorMessage(err);
    if (
      message.includes('OAuthException') ||
      message.includes('"code":190') ||
      message.includes(' 401')
    ) {
      this.logger.error(
        `Meta Ads sync failed (org ${organizationId}) — access token likely expired. Generate a new one via ` +
          `Graph API Explorer + Access Token Debugger ("Extend Access Token") and update this tenant's Meta Ads ` +
          `connection in Settings. Original error: ${message}`,
      );
      return;
    }
    this.logger.error(
      `Meta Ads sync failed (org ${organizationId}): ${message}`,
    );
  }
}

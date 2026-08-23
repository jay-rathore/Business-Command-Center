import { Inject, Injectable } from '@nestjs/common';
import { CampaignPlatform } from '@prisma/client';
import {
  CauseClassification,
  EvidenceItem,
  InvestigationIntent,
  TrafficInvestigationResult,
} from '@hpl/shared';
import { PRISMA_EXTENDED_CLIENT } from '../../prisma/prisma-extended.provider';
import type { ExtendedPrismaClient } from '../../prisma/prisma-extended.provider';
import { TenantContext } from '../../common/context/tenant-context';
import {
  DatePeriod,
  daysInPeriod,
  getPreviousEquivalentPeriod,
  percentChange,
  toDateKey,
} from './analysis/period.util';
import { detectAnomaly } from './analysis/anomaly-detection.util';

const EVENT_LOOKBACK_DAYS = 3; // how far before the target period a CampaignEvent can still explain it
const MAJOR_EVIDENCE_SHARE = 0.5; // a channel/campaign delta explaining >=50% of the total delta is "primary"
const MINOR_EVIDENCE_SHARE = 0.1; // below this, treat the channel as unrelated/stable
const STABLE_DELTA_PCT = 10; // a channel/search delta under this % is reported as "no meaningful change"

export interface RootCauseInput {
  intent: InvestigationIntent;
  dateFrom: Date;
  dateTo: Date;
}

// Rough platform -> GA4 default-channel-group mapping, used only to line up a paused/changed
// campaign with its own slice of WebsiteChannelDaily. Heuristic by design (GA4's channel
// grouping isn't a 1:1 join key against MarketingCampaign.platform) — good enough to say "this
// campaign's channel moved with the campaign event", not exact attribution.
function channelMatchesPlatform(
  channel: string,
  platform: CampaignPlatform,
): boolean {
  const c = channel.toLowerCase();
  if (platform === 'META_ADS')
    return c.includes('paid social') || c.includes('social');
  if (platform === 'GOOGLE_ADS')
    return (
      c.includes('paid search') ||
      c.includes('paid shopping') ||
      c.includes('cross-network')
    );
  if (platform === 'ORGANIC') return c.includes('organic');
  if (platform === 'WEBSITE' || platform === 'OTHER')
    return c.includes('direct');
  return false;
}

/** Deterministic evidence-gathering and correlation engine for Traffic Intelligence — implements
 * the workflow in the Traffic Intelligence spec §8 (establish baseline, measure the anomaly,
 * break down by channel, check campaign/ad-platform/search/CRM data, correlate, classify, score
 * confidence). Every number here comes straight from the database; nothing is generated or
 * estimated by an LLM — TrafficIntelligenceService's narrative composer only rephrases the
 * finished result this produces. */
@Injectable()
export class RootCauseEngineService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT)
    private readonly prisma: ExtendedPrismaClient,
  ) {}

  async investigate(
    input: RootCauseInput,
  ): Promise<TrafficInvestigationResult> {
    const organizationId = TenantContext.get().organizationId;
    const targetPeriod: DatePeriod = { from: input.dateFrom, to: input.dateTo };
    const comparisonPeriod = getPreviousEquivalentPeriod(targetPeriod);

    const [
      targetTraffic,
      comparisonTraffic,
      targetChannels,
      comparisonChannels,
      events,
      targetAdMetrics,
      comparisonAdMetrics,
      searchDelta,
      landingPageMover,
      crmDelta,
    ] = await Promise.all([
      this.sumWebsiteTraffic(organizationId, targetPeriod),
      this.sumWebsiteTraffic(organizationId, comparisonPeriod),
      this.channelTotals(organizationId, targetPeriod),
      this.channelTotals(organizationId, comparisonPeriod),
      this.findCampaignEvents(organizationId, targetPeriod),
      this.adMetricTotals(organizationId, targetPeriod),
      this.adMetricTotals(organizationId, comparisonPeriod),
      this.searchConsoleDelta(organizationId, targetPeriod, comparisonPeriod),
      this.topLandingPageMover(organizationId, targetPeriod, comparisonPeriod),
      this.crmDelta(organizationId, targetPeriod, comparisonPeriod),
    ]);

    const totalDeltaPct = percentChange(
      comparisonTraffic.visitors,
      targetTraffic.visitors,
    );
    const direction: 'up' | 'down' | 'flat' =
      totalDeltaPct == null || Math.abs(totalDeltaPct) < 1
        ? 'flat'
        : totalDeltaPct > 0
          ? 'up'
          : 'down';

    const isSingleDay =
      toDateKey(targetPeriod.from) === toDateKey(targetPeriod.to);
    const anomalyConfirmed = isSingleDay
      ? await this.confirmDayIsAnomaly(organizationId, targetPeriod.from)
      : Math.abs(totalDeltaPct ?? 0) >= 25;

    const evidence = this.buildEvidence(
      events,
      targetChannels,
      comparisonChannels,
      targetAdMetrics,
      comparisonAdMetrics,
      targetTraffic.visitors - comparisonTraffic.visitors,
    );

    this.addSearchAndLandingPageEvidence(
      evidence,
      searchDelta,
      landingPageMover,
      direction,
    );
    this.addCrmEvidence(evidence, crmDelta, direction);

    const primaryCause =
      evidence.find((e) => e.classification === 'primary') ?? null;
    const dataSourcesWithData = [
      targetChannels.size > 0 || comparisonChannels.size > 0,
      events.length > 0 || targetAdMetrics.byCampaign.size > 0,
      searchDelta.hasData,
      landingPageMover != null,
      crmDelta.hasData,
    ].filter(Boolean).length;

    const primaryEvent = primaryCause
      ? (events.find((e) => e.campaignId === primaryCause.campaignId) ?? null)
      : null;
    const daysGapToPeriod = primaryEvent
      ? Math.max(
          0,
          Math.round(
            (targetPeriod.from.getTime() - primaryEvent.detectedAt.getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : null;

    const confidence = this.scoreConfidence({
      dataSourcesWithData,
      anomalyConfirmed,
      daysGapToPeriod,
      primaryCause,
      totalDelta: targetTraffic.visitors - comparisonTraffic.visitors,
    });

    const summary = this.buildSummary(
      direction,
      totalDeltaPct,
      targetPeriod,
      comparisonPeriod,
    );
    const recommendedAction = this.buildRecommendedAction(
      primaryCause,
      direction,
    );

    return {
      supported: true,
      intent: input.intent,
      summary,
      trafficChange: {
        direction,
        percent: totalDeltaPct,
        visitorsBefore: comparisonTraffic.visitors,
        visitorsAfter: targetTraffic.visitors,
        comparedWith: `${toDateKey(comparisonPeriod.from)} to ${toDateKey(comparisonPeriod.to)} (previous equivalent period)`,
      },
      primaryCause,
      supportingEvidence: evidence.filter(
        (e) => e.classification !== 'unrelated',
      ),
      contributingFactors: evidence.filter(
        (e) => e.classification === 'contributing',
      ),
      notCausedBy: evidence.filter((e) => e.classification === 'unrelated'),
      recommendedAction,
      confidence,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Data gathering ────────────────────────────────────────────────────

  private async sumWebsiteTraffic(organizationId: string, period: DatePeriod) {
    const rows = await this.prisma.websiteAnalyticsDaily.findMany({
      where: { organizationId, date: { gte: period.from, lte: period.to } },
    });
    return rows.reduce(
      (acc, r) => ({
        visitors: acc.visitors + r.activeUsers,
        sessions: acc.sessions + r.sessions,
        newVisitors: acc.newVisitors + r.newUsers,
      }),
      { visitors: 0, sessions: 0, newVisitors: 0 },
    );
  }

  private async channelTotals(
    organizationId: string,
    period: DatePeriod,
  ): Promise<Map<string, { sessions: number; conversions: number }>> {
    const rows = await this.prisma.websiteChannelDaily.findMany({
      where: { organizationId, date: { gte: period.from, lte: period.to } },
    });
    const totals = new Map<string, { sessions: number; conversions: number }>();
    for (const r of rows) {
      const existing = totals.get(r.channel) ?? { sessions: 0, conversions: 0 };
      totals.set(r.channel, {
        sessions: existing.sessions + r.sessions,
        conversions: existing.conversions + r.conversions,
      });
    }
    return totals;
  }

  private async findCampaignEvents(organizationId: string, period: DatePeriod) {
    const lookbackStart = new Date(
      period.from.getTime() - EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );
    return this.prisma.campaignEvent.findMany({
      where: {
        organizationId,
        detectedAt: { gte: lookbackStart, lte: period.to },
      },
      include: {
        campaign: { select: { id: true, name: true, platform: true } },
      },
      orderBy: { detectedAt: 'desc' },
    });
  }

  private async adMetricTotals(organizationId: string, period: DatePeriod) {
    const rows = await this.prisma.adPlatformDailyMetric.findMany({
      where: { organizationId, date: { gte: period.from, lte: period.to } },
      include: {
        campaign: { select: { id: true, name: true, platform: true } },
      },
    });
    const byCampaign = new Map<
      string,
      {
        name: string;
        platform: CampaignPlatform;
        spend: number;
        clicks: number;
        impressions: number;
      }
    >();
    for (const r of rows) {
      const existing = byCampaign.get(r.campaignId) ?? {
        name: r.campaign.name,
        platform: r.campaign.platform,
        spend: 0,
        clicks: 0,
        impressions: 0,
      };
      byCampaign.set(r.campaignId, {
        ...existing,
        spend: existing.spend + Number(r.spend),
        clicks: existing.clicks + r.clicks,
        impressions: existing.impressions + r.impressions,
      });
    }
    return { byCampaign };
  }

  private async searchConsoleDelta(
    organizationId: string,
    target: DatePeriod,
    comparison: DatePeriod,
  ) {
    const [targetRows, comparisonRows] = await Promise.all([
      this.prisma.searchConsoleDaily.findMany({
        where: { organizationId, date: { gte: target.from, lte: target.to } },
      }),
      this.prisma.searchConsoleDaily.findMany({
        where: {
          organizationId,
          date: { gte: comparison.from, lte: comparison.to },
        },
      }),
    ]);
    const sum = (rows: typeof targetRows) =>
      rows.reduce((acc, r) => acc + r.clicks, 0);
    const targetClicks = sum(targetRows);
    const comparisonClicks = sum(comparisonRows);
    return {
      hasData: targetRows.length > 0 || comparisonRows.length > 0,
      targetClicks,
      comparisonClicks,
      deltaPct: percentChange(comparisonClicks, targetClicks),
    };
  }

  private async topLandingPageMover(
    organizationId: string,
    target: DatePeriod,
    comparison: DatePeriod,
  ) {
    const [targetRows, comparisonRows] = await Promise.all([
      this.prisma.websiteLandingPageDaily.findMany({
        where: { organizationId, date: { gte: target.from, lte: target.to } },
      }),
      this.prisma.websiteLandingPageDaily.findMany({
        where: {
          organizationId,
          date: { gte: comparison.from, lte: comparison.to },
        },
      }),
    ]);
    const targetByPage = new Map<string, number>();
    for (const r of targetRows)
      targetByPage.set(
        r.landingPage,
        (targetByPage.get(r.landingPage) ?? 0) + r.sessions,
      );
    const comparisonByPage = new Map<string, number>();
    for (const r of comparisonRows)
      comparisonByPage.set(
        r.landingPage,
        (comparisonByPage.get(r.landingPage) ?? 0) + r.sessions,
      );

    let best: { page: string; before: number; after: number } | null = null;
    for (const [page, after] of targetByPage) {
      const before = comparisonByPage.get(page) ?? 0;
      if (before < 5) continue; // ignore pages with too little history to compare meaningfully
      if (!best || after - before > best.after - best.before)
        best = { page, before, after };
    }
    return best;
  }

  private async crmDelta(
    organizationId: string,
    target: DatePeriod,
    comparison: DatePeriod,
  ) {
    const [targetCount, comparisonCount] = await Promise.all([
      this.prisma.lead.count({
        where: {
          organizationId,
          campaignId: { not: null },
          createdAt: { gte: target.from, lte: target.to },
        },
      }),
      this.prisma.lead.count({
        where: {
          organizationId,
          campaignId: { not: null },
          createdAt: { gte: comparison.from, lte: comparison.to },
        },
      }),
    ]);
    return {
      hasData: targetCount > 0 || comparisonCount > 0,
      targetCount,
      comparisonCount,
      deltaPct: percentChange(comparisonCount, targetCount),
    };
  }

  private async confirmDayIsAnomaly(
    organizationId: string,
    day: Date,
  ): Promise<boolean> {
    const windowStart = new Date(day.getTime() - 35 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.websiteAnalyticsDaily.findMany({
      where: { organizationId, date: { gte: windowStart, lte: day } },
      orderBy: { date: 'asc' },
    });
    if (rows.length === 0) return false;
    const series = rows.map((r) => ({ date: r.date, value: r.activeUsers }));
    const index = series.findIndex((p) => toDateKey(p.date) === toDateKey(day));
    if (index < 0) return false;
    return detectAnomaly(series, index).isAnomaly;
  }

  // ── Correlation ───────────────────────────────────────────────────────

  private buildEvidence(
    events: Array<{
      id: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      detectedAt: Date;
      campaignId: string;
      campaign: { id: string; name: string; platform: CampaignPlatform };
    }>,
    targetChannels: Map<string, { sessions: number; conversions: number }>,
    comparisonChannels: Map<string, { sessions: number; conversions: number }>,
    targetAdMetrics: {
      byCampaign: Map<
        string,
        {
          name: string;
          platform: CampaignPlatform;
          spend: number;
          clicks: number;
          impressions: number;
        }
      >;
    },
    comparisonAdMetrics: {
      byCampaign: Map<
        string,
        {
          name: string;
          platform: CampaignPlatform;
          spend: number;
          clicks: number;
          impressions: number;
        }
      >;
    },
    totalDelta: number,
  ): EvidenceItem[] {
    const evidence: EvidenceItem[] = [];
    const seenCampaigns = new Set<string>();

    for (const event of events) {
      if (seenCampaigns.has(event.campaignId)) continue; // one evidence item per campaign, most recent event wins
      seenCampaigns.add(event.campaignId);

      // Find this campaign's own channel among GA4's channel groups, to see whether traffic
      // attributable to its platform moved alongside the event.
      let channelDelta = 0;
      let matchedChannel: string | null = null;
      for (const [channel, after] of targetChannels) {
        if (!channelMatchesPlatform(channel, event.campaign.platform)) continue;
        const before = comparisonChannels.get(channel)?.sessions ?? 0;
        channelDelta = after.sessions - before;
        matchedChannel = channel;
      }

      const targetSpend =
        targetAdMetrics.byCampaign.get(event.campaignId)?.spend ?? 0;
      const comparisonSpend =
        comparisonAdMetrics.byCampaign.get(event.campaignId)?.spend ?? 0;
      const hasAdData = targetSpend > 0 || comparisonSpend > 0;

      const share =
        totalDelta !== 0 && matchedChannel
          ? Math.abs(channelDelta) / Math.abs(totalDelta)
          : 0;
      const directionMatches =
        totalDelta === 0
          ? false
          : Math.sign(channelDelta) === Math.sign(totalDelta) ||
            (channelDelta === 0 && totalDelta === 0);

      let classification: CauseClassification;
      if (!matchedChannel && !hasAdData) {
        classification = 'possible'; // event happened but we have no data to quantify its traffic impact yet
      } else if (share >= MAJOR_EVIDENCE_SHARE && directionMatches) {
        classification = 'primary';
      } else if (share >= MINOR_EVIDENCE_SHARE && directionMatches) {
        classification = 'contributing';
      } else {
        classification = 'unrelated';
      }

      const changeDescription = this.describeEvent(event);
      const summary =
        classification === 'possible'
          ? `${event.campaign.name}: ${changeDescription} (detected ${toDateKey(event.detectedAt)}) — no daily traffic/spend data available yet to quantify its impact.`
          : matchedChannel
            ? `${event.campaign.name}: ${changeDescription} (detected ${toDateKey(event.detectedAt)}) — its channel ("${matchedChannel}") changed by ${channelDelta >= 0 ? '+' : ''}${channelDelta} sessions over the same period.`
            : `${event.campaign.name}: ${changeDescription} (detected ${toDateKey(event.detectedAt)}) — spend changed from ${comparisonSpend.toFixed(0)} to ${targetSpend.toFixed(0)} over the same period.`;

      evidence.push({
        classification,
        summary,
        campaignId: event.campaignId,
        campaignName: event.campaign.name,
        metricDelta: matchedChannel
          ? channelDelta
          : targetSpend - comparisonSpend,
      });
    }

    return evidence;
  }

  private describeEvent(event: {
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }): string {
    if (event.field === 'status')
      return `campaign status changed from ${event.oldValue ?? 'unknown'} to ${event.newValue ?? 'unknown'}`;
    if (event.field === 'dailyBudget')
      return `daily budget changed from ${event.oldValue ?? 'unset'} to ${event.newValue ?? 'unset'}`;
    return `campaign ${event.field} changed from "${event.oldValue ?? 'unknown'}" to "${event.newValue ?? 'unknown'}"`;
  }

  private addSearchAndLandingPageEvidence(
    evidence: EvidenceItem[],
    search: {
      hasData: boolean;
      deltaPct: number | null;
      targetClicks: number;
      comparisonClicks: number;
    },
    landingPageMover: { page: string; before: number; after: number } | null,
    direction: 'up' | 'down' | 'flat',
  ): void {
    if (search.hasData) {
      const stable =
        search.deltaPct == null || Math.abs(search.deltaPct) < STABLE_DELTA_PCT;
      // A delta is only evidence FOR the overall change if it actually moved the same way —
      // Search clicks falling while total traffic rose is not "consistent," it's a separate,
      // unrelated movement (and asserting otherwise is exactly the false-correlation trap the
      // Traffic Intelligence spec warns against).
      const directionMatches =
        !stable &&
        direction !== 'flat' &&
        Math.sign(search.deltaPct as number) === (direction === 'up' ? 1 : -1);

      let classification: CauseClassification;
      let summary: string;
      if (stable) {
        classification = 'unrelated';
        summary =
          'Organic search traffic (Search Console clicks) remained relatively stable — no evidence it caused this change.';
      } else if (directionMatches) {
        classification = 'contributing';
        summary = `Search Console clicks changed by ${(search.deltaPct as number).toFixed(0)}% (${search.comparisonClicks} → ${search.targetClicks}), consistent with the overall traffic ${direction}.`;
      } else {
        classification = 'unrelated';
        summary = `Search Console clicks changed by ${(search.deltaPct as number).toFixed(0)}% (${search.comparisonClicks} → ${search.targetClicks}), but moved opposite to the overall traffic ${direction} — not a driver of this change.`;
      }
      evidence.push({
        classification,
        summary,
        campaignId: null,
        campaignName: null,
        metricDelta: search.deltaPct,
      });
    }

    if (landingPageMover && direction !== 'flat') {
      const ratio =
        landingPageMover.before > 0
          ? landingPageMover.after / landingPageMover.before
          : landingPageMover.after > 0
            ? Infinity
            : 1;
      // Only report the mover if its own direction matches the overall traffic direction —
      // a page that lost traffic isn't a "contributing factor" in a period where traffic rose.
      const risingAndRelevant = direction === 'up' && ratio >= 1.5;
      const fallingAndRelevant = direction === 'down' && ratio <= 0.5;
      if (risingAndRelevant || fallingAndRelevant) {
        evidence.push({
          classification: 'contributing',
          summary: `Landing page "${landingPageMover.page}" traffic changed ${Number.isFinite(ratio) ? `${ratio.toFixed(1)}x` : 'sharply'} (${landingPageMover.before} → ${landingPageMover.after} sessions).`,
          campaignId: null,
          campaignName: null,
          metricDelta: landingPageMover.after - landingPageMover.before,
        });
      }
    }
  }

  private addCrmEvidence(
    evidence: EvidenceItem[],
    crm: {
      hasData: boolean;
      deltaPct: number | null;
      targetCount: number;
      comparisonCount: number;
    },
    direction: 'up' | 'down' | 'flat',
  ): void {
    if (!crm.hasData) return;
    const stable =
      crm.deltaPct == null || Math.abs(crm.deltaPct) < STABLE_DELTA_PCT;
    const directionMatches =
      !stable &&
      direction !== 'flat' &&
      Math.sign(crm.deltaPct as number) === (direction === 'up' ? 1 : -1);

    let classification: CauseClassification;
    let summary: string;
    if (stable) {
      classification = 'unrelated';
      summary =
        'Campaign-attributed lead volume stayed roughly flat over the same period.';
    } else if (directionMatches) {
      classification = 'contributing';
      summary = `Campaign-attributed leads changed by ${(crm.deltaPct as number).toFixed(0)}% (${crm.comparisonCount} → ${crm.targetCount}), moving in the same direction as traffic ${direction}.`;
    } else {
      classification = 'unrelated';
      summary = `Campaign-attributed leads changed by ${(crm.deltaPct as number).toFixed(0)}% (${crm.comparisonCount} → ${crm.targetCount}), but moved opposite to the overall traffic ${direction} — not a driver of this change.`;
    }
    evidence.push({
      classification,
      summary,
      campaignId: null,
      campaignName: null,
      metricDelta: crm.deltaPct,
    });
  }

  // ── Confidence scoring ───────────────────────────────────────────────

  /** Explicit, inspectable formula — never an arbitrary number. Base 40, plus up to +20 for how
   * many of the 5 evidence categories actually returned data, up to +20 for how temporally close
   * the primary-cause event is to the period being investigated, up to +20 for how much of the
   * total traffic delta that cause's own channel accounts for, minus a penalty when the period
   * was confirmed anomalous but no primary cause could be pinned down (high uncertainty), minus a
   * smaller penalty when a primary cause was found but only weakly explains the delta. Clamped to
   * [5, 95] — this system never claims certainty. */
  private scoreConfidence(input: {
    dataSourcesWithData: number;
    anomalyConfirmed: boolean;
    daysGapToPeriod: number | null;
    primaryCause: EvidenceItem | null;
    totalDelta: number;
  }): { score: number; label: 'High' | 'Medium' | 'Low' } {
    let score = 40;
    score += Math.round((input.dataSourcesWithData / 5) * 20);

    if (input.primaryCause && input.daysGapToPeriod != null) {
      score +=
        input.daysGapToPeriod <= 1 ? 20 : input.daysGapToPeriod <= 3 ? 12 : 5;

      const magnitudeRatio =
        input.totalDelta !== 0 && input.primaryCause.metricDelta != null
          ? Math.min(
              1,
              Math.abs(input.primaryCause.metricDelta / input.totalDelta),
            )
          : 0;
      score += Math.round(magnitudeRatio * 20);
      if (magnitudeRatio < 0.4) score -= 15;
    } else if (input.anomalyConfirmed) {
      score -= 25;
    }

    score = Math.max(5, Math.min(95, score));
    const label = score >= 80 ? 'High' : score >= 55 ? 'Medium' : 'Low';
    return { score, label };
  }

  // ── Prose (template-based — see RuleBasedTrafficNarrativeComposer) ─────

  private buildSummary(
    direction: 'up' | 'down' | 'flat',
    percent: number | null,
    target: DatePeriod,
    comparison: DatePeriod,
  ): string {
    const periodLabel =
      daysInPeriod(target) === 1
        ? `on ${toDateKey(target.from)}`
        : `from ${toDateKey(target.from)} to ${toDateKey(target.to)}`;
    if (direction === 'flat' || percent == null)
      return `Website traffic was roughly stable ${periodLabel} compared with the previous equivalent period.`;
    return `Website traffic ${direction === 'up' ? 'increased' : 'decreased'} by ${Math.abs(percent).toFixed(0)}% ${periodLabel}, compared with ${toDateKey(comparison.from)}–${toDateKey(comparison.to)}.`;
  }

  private buildRecommendedAction(
    primaryCause: EvidenceItem | null,
    direction: 'up' | 'down' | 'flat',
  ): string {
    if (!primaryCause) {
      return 'No single cause could be confidently identified from connected data. Monitor the next few days and check for factors outside Command Center (seasonality, holidays, competitor activity, tracking/analytics outages).';
    }
    if (direction === 'down') {
      return `Review "${primaryCause.campaignName}" and consider restarting or reversing the recent change if its previous conversion efficiency remains acceptable.`;
    }
    if (direction === 'up') {
      return `Consider extending or scaling "${primaryCause.campaignName}" further while monitoring conversion quality for the next 3–7 days.`;
    }
    return 'Traffic is stable — no action needed based on current evidence.';
  }
}

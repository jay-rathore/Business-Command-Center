import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PRISMA_EXTENDED_CLIENT } from '../../prisma/prisma-extended.provider';
import type { ExtendedPrismaClient } from '../../prisma/prisma-extended.provider';
import { TenantContext } from '../../common/context/tenant-context';
import {
  CampaignRecommendationResult,
  InvestigationQuery,
  ProactiveInsight,
  TrafficChannelEntry,
  TrafficEventDetail,
  TrafficInvestigationResult,
  TrafficOverview,
  TrafficTimelineEvent,
} from '@hpl/shared';
import { RootCauseEngineService } from './root-cause-engine.service';
import { CampaignRecommendationService } from './campaign-recommendation.service';
import {
  ProactiveInsightsService,
  ProactiveInsightsRunResult,
} from './proactive-insights.service';
import { InvestigationQueryParserService } from './investigation-query-parser.service';
import { OpenAiTrafficNarrativeComposer } from './narrative-composer.service';
import { TRAFFIC_NARRATIVE_COMPOSER } from './traffic-narrative.port';
import type { TrafficNarrativePort } from './traffic-narrative.port';
import { detectAnomaly } from './analysis/anomaly-detection.util';
import {
  DatePeriod,
  parseDateOnly,
  percentChange,
  toDateKey,
} from './analysis/period.util';

const DEFAULT_WINDOW_DAYS = 30;
const ANOMALY_BASELINE_LOOKBACK_DAYS = 28; // extra history pulled so the first days of the window still get a real baseline

@Injectable()
export class TrafficIntelligenceService {
  private readonly logger = new Logger(TrafficIntelligenceService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT)
    private readonly prisma: ExtendedPrismaClient,
    private readonly rootCauseEngine: RootCauseEngineService,
    private readonly campaignRecommendation: CampaignRecommendationService,
    private readonly proactiveInsights: ProactiveInsightsService,
    private readonly queryParser: InvestigationQueryParserService,
    private readonly openAiComposer: OpenAiTrafficNarrativeComposer,
    @Inject(TRAFFIC_NARRATIVE_COMPOSER)
    private readonly fallbackComposer: TrafficNarrativePort,
  ) {}

  async getOverview(
    dateFromStr?: string,
    dateToStr?: string,
  ): Promise<TrafficOverview> {
    const organizationId = TenantContext.get().organizationId;
    const { from, to } = this.resolveRange(dateFromStr, dateToStr);
    const extendedFrom = new Date(
      from.getTime() - ANOMALY_BASELINE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );

    const [extendedRows, channelRows] = await Promise.all([
      this.prisma.websiteAnalyticsDaily.findMany({
        where: { organizationId, date: { gte: extendedFrom, lte: to } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.websiteChannelDaily.findMany({
        where: { organizationId, date: { gte: from, lte: to } },
      }),
    ]);

    const anomalySeries = extendedRows.map((r) => ({
      date: r.date,
      value: r.activeUsers,
    }));
    const windowRows = extendedRows.filter(
      (r) =>
        r.date.getTime() >= from.getTime() && r.date.getTime() <= to.getTime(),
    );

    const series = windowRows.map((r) => {
      const index = anomalySeries.findIndex(
        (p) => toDateKey(p.date) === toDateKey(r.date),
      );
      const anomaly = detectAnomaly(anomalySeries, index);
      const returningVisitors = Math.max(0, r.activeUsers - r.newUsers);
      return {
        date: toDateKey(r.date),
        visitors: r.activeUsers,
        sessions: r.sessions,
        pageViews: r.pageViews,
        newVisitors: r.newUsers,
        returningVisitors,
        conversions: r.conversions,
        conversionRate:
          r.sessions > 0 ? (r.conversions / r.sessions) * 100 : null,
        isAnomaly: anomaly.isAnomaly,
        anomalyDirection: anomaly.direction,
      };
    });

    const channelTotals = new Map<string, TrafficChannelEntry>();
    for (const row of channelRows) {
      const existing = channelTotals.get(row.channel) ?? {
        channel: row.channel,
        sessions: 0,
        conversions: 0,
      };
      channelTotals.set(row.channel, {
        channel: row.channel,
        sessions: existing.sessions + row.sessions,
        conversions: existing.conversions + row.conversions,
      });
    }

    const totals = windowRows.reduce(
      (acc, r) => ({
        visitors: acc.visitors + r.activeUsers,
        sessions: acc.sessions + r.sessions,
        pageViews: acc.pageViews + r.pageViews,
        conversions: acc.conversions + r.conversions,
      }),
      { visitors: 0, sessions: 0, pageViews: 0, conversions: 0 },
    );

    return {
      series,
      channelBreakdown: Array.from(channelTotals.values()).sort(
        (a, b) => b.sessions - a.sessions,
      ),
      totals: {
        ...totals,
        conversionRate:
          totals.sessions > 0
            ? (totals.conversions / totals.sessions) * 100
            : null,
      },
      deltas: this.computeDeltas(windowRows.map((r) => r.activeUsers)),
    };
  }

  async getTimeline(
    dateFromStr?: string,
    dateToStr?: string,
  ): Promise<TrafficTimelineEvent[]> {
    const organizationId = TenantContext.get().organizationId;
    const { from, to } = this.resolveRange(dateFromStr, dateToStr);

    const [events, overview] = await Promise.all([
      this.prisma.campaignEvent.findMany({
        where: { organizationId, detectedAt: { gte: from, lte: to } },
        include: {
          campaign: { select: { id: true, name: true, platform: true } },
        },
        orderBy: { detectedAt: 'asc' },
      }),
      this.getOverview(dateFromStr, dateToStr),
    ]);

    const eventItems: TrafficTimelineEvent[] = events.map((e) => ({
      id: e.id,
      type:
        e.field === 'status'
          ? 'STATUS_CHANGED'
          : e.field === 'dailyBudget'
            ? 'BUDGET_CHANGED'
            : 'NAME_CHANGED',
      occurredAt: e.detectedAt.toISOString(),
      label: `${e.campaign.name}: ${e.field} ${e.oldValue ?? '—'} → ${e.newValue ?? '—'}`,
      campaignId: e.campaignId,
      campaignName: e.campaign.name,
      platform: e.campaign.platform,
    }));

    const anomalyItems: TrafficTimelineEvent[] = overview.series
      .filter((d) => d.isAnomaly)
      .map((d) => ({
        id: `anomaly:${d.date}`,
        type: 'TRAFFIC_ANOMALY',
        occurredAt: `${d.date}T00:00:00.000Z`,
        label: `Traffic ${d.anomalyDirection === 'up' ? 'spike' : 'drop'} on ${d.date}`,
        campaignId: null,
        campaignName: null,
        platform: null,
      }));

    return [...eventItems, ...anomalyItems].sort((a, b) =>
      a.occurredAt.localeCompare(b.occurredAt),
    );
  }

  async getProactiveInsights(limit = 10): Promise<ProactiveInsight[]> {
    const organizationId = TenantContext.get().organizationId;
    const rows = await this.prisma.aIInsight.findMany({
      where: { organizationId, category: 'MARKETING' },
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      priority: r.priority,
      headline: r.headline,
      whatHappened: r.whatHappened,
      whyItHappened: r.whyItHappened,
      businessImpact: r.businessImpact,
      recommendedAction: r.recommendedAction,
      confidence: r.confidence,
      generatedAt: r.generatedAt.toISOString(),
    }));
  }

  runProactiveInsightsDigest(): Promise<ProactiveInsightsRunResult> {
    return this.proactiveInsights.runForCurrentTenant();
  }

  async getEventDetail(id: string): Promise<TrafficEventDetail> {
    if (id.startsWith('anomaly:'))
      return this.getAnomalyDetail(id.slice('anomaly:'.length));

    const organizationId = TenantContext.get().organizationId;
    const event = await this.prisma.campaignEvent.findFirst({
      where: { id, organizationId },
      include: {
        campaign: { select: { id: true, name: true, platform: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const day = new Date(toDateKey(event.detectedAt) + 'T00:00:00.000Z');
    const dayBefore = new Date(day.getTime() - 24 * 60 * 60 * 1000);
    const [afterRow, beforeRow] = await Promise.all([
      this.prisma.websiteAnalyticsDaily.findFirst({
        where: { organizationId, date: day },
      }),
      this.prisma.websiteAnalyticsDaily.findFirst({
        where: { organizationId, date: dayBefore },
      }),
    ]);
    const delta =
      afterRow && beforeRow
        ? percentChange(beforeRow.activeUsers, afterRow.activeUsers)
        : null;

    return {
      id: event.id,
      type:
        event.field === 'status'
          ? 'STATUS_CHANGED'
          : event.field === 'dailyBudget'
            ? 'BUDGET_CHANGED'
            : 'NAME_CHANGED',
      occurredAt: event.detectedAt.toISOString(),
      label: `${event.campaign.name}: ${event.field} ${event.oldValue ?? '—'} → ${event.newValue ?? '—'}`,
      campaignId: event.campaignId,
      campaignName: event.campaign.name,
      platform: event.campaign.platform,
      field: event.field,
      oldValue: event.oldValue,
      newValue: event.newValue,
      trafficImpact:
        delta != null
          ? `Website traffic ${delta >= 0 ? 'increased' : 'decreased'} ${Math.abs(delta).toFixed(0)}% the day this was detected, vs the day before.`
          : null,
      aiInterpretation:
        'Ask the AI Investigation panel about this date for a full cross-platform root-cause analysis.',
    };
  }

  async investigate(
    query: InvestigationQuery,
  ): Promise<TrafficInvestigationResult> {
    let dateFrom = query.dateFrom;
    let dateTo = query.dateTo;
    let intent: TrafficInvestigationResult['intent'] = 'general';
    // Explicit dateFrom/dateTo passed directly (e.g. a timeline-event drill-down) counts as
    // explicit too — only the "question had no date at all, defaulted to yesterday" case is not.
    let dateWasExplicit = Boolean(query.dateFrom && query.dateTo);

    if (query.question && (!dateFrom || !dateTo)) {
      const parsed = await this.queryParser.parse(query.question);
      dateFrom = parsed.dateFrom;
      dateTo = parsed.dateTo;
      intent = parsed.intent;
      dateWasExplicit = parsed.dateWasExplicit;
    } else if (!dateFrom || !dateTo) {
      throw new BadRequestException(
        'Provide either a question or an explicit dateFrom/dateTo range',
      );
    }

    if (intent === 'recommend_campaign') {
      // Only scope the ranking to a period when the user actually asked about one ("which
      // campaign gave best results on Aug 5th") — an undated "which campaign should I re-run"
      // should rank by lifetime performance, not get silently scoped to a default single day.
      const period: DatePeriod | undefined = dateWasExplicit
        ? { from: parseDateOnly(dateFrom), to: parseDateOnly(dateTo) }
        : undefined;
      const recommendation =
        await this.campaignRecommendation.recommend(period);
      return this.buildRecommendationResponse(recommendation, period);
    }

    const result = await this.rootCauseEngine.investigate({
      intent,
      dateFrom: parseDateOnly(dateFrom),
      dateTo: parseDateOnly(dateTo),
    });

    try {
      return await this.openAiComposer.compose(result);
    } catch (err) {
      this.logger.warn(
        `Narrative composition via OpenAI unavailable, using rule-based phrasing: ${err instanceof Error ? err.message : err}`,
      );
      return this.fallbackComposer.compose(result);
    }
  }

  private async getAnomalyDetail(dateKey: string): Promise<TrafficEventDetail> {
    const day = parseDateOnly(dateKey);
    const investigation = await this.rootCauseEngine.investigate({
      intent: 'general',
      dateFrom: day,
      dateTo: day,
    });

    return {
      id: `anomaly:${dateKey}`,
      type: 'TRAFFIC_ANOMALY',
      occurredAt: `${dateKey}T00:00:00.000Z`,
      label: `Traffic ${investigation.trafficChange.direction === 'up' ? 'spike' : 'drop'} on ${dateKey}`,
      campaignId: investigation.primaryCause?.campaignId ?? null,
      campaignName: investigation.primaryCause?.campaignName ?? null,
      platform: null,
      field: null,
      oldValue: null,
      newValue: null,
      trafficImpact: `${investigation.trafficChange.visitorsBefore} → ${investigation.trafficChange.visitorsAfter} visitors (${investigation.trafficChange.percent?.toFixed(0) ?? '—'}%)`,
      aiInterpretation:
        investigation.primaryCause?.summary ?? investigation.summary,
    };
  }

  /** Maps CampaignRecommendationService's ranked-list result into the shared
   * TrafficInvestigationResult envelope (see `recommendation` field) so the frontend's one
   * result card and the /investigate endpoint's one response contract can serve both a
   * root-cause answer and a recommendation answer. Confidence here means "how clearly the
   * winner beat the runner-up" (score gap), not "how good the campaign is" — a winner that
   * barely edged out the alternative is a low-confidence pick even if its own score is high. */
  private buildRecommendationResponse(
    recommendation: CampaignRecommendationResult,
    period?: DatePeriod,
  ): TrafficInvestigationResult {
    const periodLabel = period
      ? toDateKey(period.from) === toDateKey(period.to)
        ? `on ${toDateKey(period.from)}`
        : `from ${toDateKey(period.from)} to ${toDateKey(period.to)}`
      : null;

    const winner = recommendation.recommended;
    if (!winner) {
      return {
        supported: false,
        intent: 'recommend_campaign',
        summary: periodLabel
          ? `No campaign has enough click/lead data ${periodLabel} to confidently recommend one.`
          : 'No campaign currently has enough click/lead history to confidently recommend one.',
        trafficChange: {
          direction: 'flat',
          percent: null,
          visitorsBefore: 0,
          visitorsAfter: 0,
          comparedWith: '',
        },
        primaryCause: null,
        supportingEvidence: [],
        contributingFactors: [],
        notCausedBy: [],
        recommendedAction:
          'Let campaigns run longer to accumulate enough clicks/leads, or compare them directly on the Campaigns tab.',
        confidence: { score: 5, label: 'Low' },
        recommendation,
        generatedAt: recommendation.generatedAt,
      };
    }

    const gap =
      recommendation.alternatives.length > 0
        ? winner.score - recommendation.alternatives[0].score
        : winner.score;
    const score = Math.max(5, Math.min(95, Math.round(40 + gap)));
    const label = score >= 80 ? 'High' : score >= 55 ? 'Medium' : 'Low';

    return {
      supported: true,
      intent: 'recommend_campaign',
      summary: periodLabel
        ? `"${winner.campaignName}" gave the best results ${periodLabel}, based on conversion rate, cost per lead, and lead volume.`
        : `"${winner.campaignName}" is the strongest candidate to re-run, based on conversion rate, cost per lead, and lead volume across your campaign history.`,
      trafficChange: {
        direction: 'flat',
        percent: null,
        visitorsBefore: 0,
        visitorsAfter: 0,
        comparedWith: '',
      },
      primaryCause: null,
      supportingEvidence: [],
      contributingFactors: [],
      notCausedBy: [],
      recommendedAction: recommendation.recommendationText,
      confidence: { score, label },
      recommendation,
      generatedAt: recommendation.generatedAt,
    };
  }

  private resolveRange(dateFromStr?: string, dateToStr?: string): DatePeriod {
    const to = dateToStr
      ? parseDateOnly(dateToStr)
      : parseDateOnly(toDateKey(new Date()));
    const from = dateFromStr
      ? parseDateOnly(dateFromStr)
      : new Date(
          to.getTime() - (DEFAULT_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
        );
    return { from, to };
  }

  private computeDeltas(visitorsByDay: number[]): TrafficOverview['deltas'] {
    const n = visitorsByDay.length;
    const dayOverDay =
      n >= 2 ? percentChange(visitorsByDay[n - 2], visitorsByDay[n - 1]) : null;

    let weekOverWeek: number | null = null;
    if (n >= 14) {
      const lastWeek = visitorsByDay.slice(n - 7).reduce((a, b) => a + b, 0);
      const priorWeek = visitorsByDay
        .slice(n - 14, n - 7)
        .reduce((a, b) => a + b, 0);
      weekOverWeek = percentChange(priorWeek, lastWeek);
    }

    return { dayOverDay, weekOverWeek };
  }
}

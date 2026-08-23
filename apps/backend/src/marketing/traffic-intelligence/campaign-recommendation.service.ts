import { Inject, Injectable } from '@nestjs/common';
import {
  CampaignDataQualityWarning,
  CampaignRecommendationCandidate,
  CampaignRecommendationResult,
} from '@hpl/shared';
import { PRISMA_EXTENDED_CLIENT } from '../../prisma/prisma-extended.provider';
import type { ExtendedPrismaClient } from '../../prisma/prisma-extended.provider';
import { TenantContext } from '../../common/context/tenant-context';
import { DatePeriod, toDateKey } from './analysis/period.util';

const MIN_CLICKS = 20;
const MIN_LEADS = 3;
const MAX_ALTERNATIVES = 4;

// Explicit, documented weights — same "never arbitrary" posture as RootCauseEngineService's
// confidence formula. If no eligible campaign has revenue data, ROAS's weight is redistributed
// proportionally across the rest (see scoreCampaigns) rather than silently treated as 0.
const BASE_WEIGHTS = {
  conversionRate: 0.3,
  costPerConversion: 0.25,
  roas: 0.2,
  leadsCount: 0.15,
  ctr: 0.1,
};

interface RawMetrics {
  id: string;
  name: string;
  status: string;
  clicks: number;
  conversionRate: number | null;
  costPerConversion: number | null;
  roas: number | null;
  leadsCount: number;
  ctr: number | null;
}

/** Deterministic campaign-ranking engine — answers "which campaign should I re-run for the best
 * traffic and conversions" (Traffic Intelligence spec §6). Every score is a documented, min-max
 * normalized weighted sum; nothing is estimated by an LLM. Two data sources feed the same ranking
 * core (rankCampaigns): lifetime-cumulative MarketingCampaign fields when no period is given (the
 * "best campaign overall" question), or period-summed AdPlatformDailyMetric rows when the caller
 * asks about a specific date/range (e.g. "which campaign gave best results on Aug 5th") — without
 * this, a date-scoped question would silently get the same lifetime answer as an undated one. */
@Injectable()
export class CampaignRecommendationService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT)
    private readonly prisma: ExtendedPrismaClient,
  ) {}

  async recommend(period?: DatePeriod): Promise<CampaignRecommendationResult> {
    if (period) return this.recommendForPeriod(period);
    return this.recommendLifetime();
  }

  private async recommendLifetime(): Promise<CampaignRecommendationResult> {
    const campaigns = await this.prisma.marketingCampaign.findMany();

    const raw: RawMetrics[] = campaigns.map((c) => {
      const spend = Number(c.spend);
      const revenue = Number(c.revenue);
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        clicks: c.clicks,
        conversionRate: c.clicks > 0 ? (c.leadsCount / c.clicks) * 100 : null,
        costPerConversion: c.leadsCount > 0 ? spend / c.leadsCount : null,
        roas: revenue > 0 && spend > 0 ? revenue / spend : null,
        leadsCount: c.leadsCount,
        ctr: c.impressions > 0 ? Number(c.ctr) : null,
      };
    });

    return this.rankCampaigns(raw, null);
  }

  /** AdPlatformDailyMetric only exists for Meta/Google Ads campaigns synced with Phase 1's daily
   * insights pull (trailing 60 days) — a campaign with no rows in the period (not running yet,
   * outside the sync window, or a WEBSITE/ORGANIC/OTHER-platform demo row with no daily data at
   * all) naturally lands in "insufficient data" below rather than being silently skipped. Revenue
   * isn't tracked per day (only lifetime, and only ever fabricated for demo rows — never against
   * real spend, see marketing.service.ts), so ROAS is always null for a period-scoped ranking. */
  private async recommendForPeriod(
    period: DatePeriod,
  ): Promise<CampaignRecommendationResult> {
    const organizationId = TenantContext.get().organizationId;
    const [campaigns, dailyRows] = await Promise.all([
      this.prisma.marketingCampaign.findMany({
        select: { id: true, name: true, status: true },
      }),
      this.prisma.adPlatformDailyMetric.findMany({
        where: { organizationId, date: { gte: period.from, lte: period.to } },
      }),
    ]);

    const totals = new Map<
      string,
      {
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
      }
    >();
    for (const row of dailyRows) {
      const existing = totals.get(row.campaignId) ?? {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      };
      totals.set(row.campaignId, {
        spend: existing.spend + Number(row.spend),
        impressions: existing.impressions + row.impressions,
        clicks: existing.clicks + row.clicks,
        conversions: existing.conversions + row.conversions,
      });
    }

    const raw: RawMetrics[] = campaigns.map((c) => {
      const t = totals.get(c.id) ?? {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      };
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        clicks: t.clicks,
        conversionRate: t.clicks > 0 ? (t.conversions / t.clicks) * 100 : null,
        costPerConversion: t.conversions > 0 ? t.spend / t.conversions : null,
        roas: null,
        leadsCount: t.conversions,
        ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null,
      };
    });

    const periodLabel =
      toDateKey(period.from) === toDateKey(period.to)
        ? `on ${toDateKey(period.from)}`
        : `from ${toDateKey(period.from)} to ${toDateKey(period.to)}`;
    return this.rankCampaigns(raw, periodLabel);
  }

  private rankCampaigns(
    raw: RawMetrics[],
    periodLabel: string | null,
  ): CampaignRecommendationResult {
    // A campaign reporting more leads than clicks is not possible for a genuine one-lead-per-click
    // conversion action — it means the platform's "conversions" count is blended with something
    // else (calls, page views, engagement...), not filtered to actual leads. Score against that
    // number and the recommendation would just reward whichever campaign has the noisiest
    // conversion tracking, so these are excluded and surfaced as a data-quality warning instead of
    // silently folded into "insufficient data" (a different, unrelated problem).
    const dataQualityWarnings: CampaignDataQualityWarning[] = raw
      .filter((c) => c.leadsCount > c.clicks)
      .map((c) => ({
        campaignName: c.name,
        issue: `Reports more leads than clicks (${c.leadsCount} vs ${c.clicks}) — its "conversions" tracking likely isn't filtered to real leads.`,
      }));
    const dataQualityIds = new Set(
      raw.filter((c) => c.leadsCount > c.clicks).map((c) => c.id),
    );

    const eligible = raw.filter(
      (c) =>
        !dataQualityIds.has(c.id) &&
        c.clicks >= MIN_CLICKS &&
        c.leadsCount >= MIN_LEADS,
    );
    const insufficientDataCampaigns = raw
      .filter((c) => !eligible.includes(c) && !dataQualityIds.has(c.id))
      .map((c) => c.name);

    if (eligible.length === 0) {
      return {
        recommended: null,
        alternatives: [],
        insufficientDataCampaigns,
        dataQualityWarnings,
        recommendationText: periodLabel
          ? `No campaign has enough click/lead data ${periodLabel} to confidently recommend one.`
          : '',
        generatedAt: new Date().toISOString(),
      };
    }

    const scored = this.scoreCampaigns(eligible);
    scored.sort((a, b) => b.score - a.score);

    const [winnerScored, ...restScored] = scored;
    const winnerRaw = eligible.find((c) => c.id === winnerScored.id)!;
    const alternatives: CampaignRecommendationCandidate[] = restScored
      .slice(0, MAX_ALTERNATIVES)
      .map((alt) => {
        const altRaw = eligible.find((c) => c.id === alt.id)!;
        return {
          campaignId: alt.id,
          campaignName: altRaw.name,
          score: alt.score,
          metrics: this.toMetrics(altRaw),
          reasonNotSelected: this.buildReasonNotSelected(winnerRaw, altRaw),
        };
      });

    const recommended: CampaignRecommendationCandidate = {
      campaignId: winnerRaw.id,
      campaignName: winnerRaw.name,
      score: winnerScored.score,
      metrics: this.toMetrics(winnerRaw),
      reasonNotSelected: null,
    };

    return {
      recommended,
      alternatives,
      insufficientDataCampaigns,
      dataQualityWarnings,
      recommendationText: this.buildRecommendationText(winnerRaw, periodLabel),
      generatedAt: new Date().toISOString(),
    };
  }

  private toMetrics(c: RawMetrics) {
    return {
      conversionRate: c.conversionRate,
      costPerConversion: c.costPerConversion,
      roas: c.roas,
      leadsCount: c.leadsCount,
      ctr: c.ctr,
    };
  }

  private scoreCampaigns(
    eligible: RawMetrics[],
  ): Array<{ id: string; score: number }> {
    const roasAvailable = eligible.some((c) => c.roas != null);
    const weights = roasAvailable
      ? BASE_WEIGHTS
      : {
          conversionRate: BASE_WEIGHTS.conversionRate / (1 - BASE_WEIGHTS.roas),
          costPerConversion:
            BASE_WEIGHTS.costPerConversion / (1 - BASE_WEIGHTS.roas),
          roas: 0,
          leadsCount: BASE_WEIGHTS.leadsCount / (1 - BASE_WEIGHTS.roas),
          ctr: BASE_WEIGHTS.ctr / (1 - BASE_WEIGHTS.roas),
        };

    const normalize = (
      values: Array<number | null>,
      invert: boolean,
    ): number[] => {
      const present = values.filter((v): v is number => v != null);
      if (present.length === 0) return values.map(() => 0);
      const min = Math.min(...present);
      const max = Math.max(...present);
      return values.map((v) => {
        if (v == null) return 0;
        if (max === min) return 1; // no discriminating power — credit fully rather than divide by zero
        const n = (v - min) / (max - min);
        return invert ? 1 - n : n;
      });
    };

    const conversionRateN = normalize(
      eligible.map((c) => c.conversionRate),
      false,
    );
    const costPerConversionN = normalize(
      eligible.map((c) => c.costPerConversion),
      true,
    );
    const roasN = normalize(
      eligible.map((c) => c.roas),
      false,
    );
    const leadsCountN = normalize(
      eligible.map((c) => c.leadsCount),
      false,
    );
    const ctrN = normalize(
      eligible.map((c) => c.ctr),
      false,
    );

    return eligible.map((c, i) => ({
      id: c.id,
      score:
        100 *
        (weights.conversionRate * conversionRateN[i] +
          weights.costPerConversion * costPerConversionN[i] +
          weights.roas * roasN[i] +
          weights.leadsCount * leadsCountN[i] +
          weights.ctr * ctrN[i]),
    }));
  }

  private buildReasonNotSelected(winner: RawMetrics, alt: RawMetrics): string {
    const gaps: Array<{ label: string; gapPct: number }> = [];
    if (
      winner.conversionRate != null &&
      alt.conversionRate != null &&
      winner.conversionRate > 0
    ) {
      const gapPct =
        ((winner.conversionRate - alt.conversionRate) / winner.conversionRate) *
        100;
      if (gapPct > 0)
        gaps.push({
          label: `${gapPct.toFixed(0)}% lower conversion rate (${alt.conversionRate.toFixed(1)}% vs ${winner.conversionRate.toFixed(1)}%)`,
          gapPct,
        });
    }
    if (
      winner.costPerConversion != null &&
      alt.costPerConversion != null &&
      winner.costPerConversion > 0
    ) {
      const gapPct =
        ((alt.costPerConversion - winner.costPerConversion) /
          winner.costPerConversion) *
        100;
      if (gapPct > 0)
        gaps.push({
          label: `${gapPct.toFixed(0)}% higher cost per lead (${alt.costPerConversion.toFixed(0)} vs ${winner.costPerConversion.toFixed(0)})`,
          gapPct,
        });
    }
    if (winner.leadsCount > 0) {
      const gapPct =
        ((winner.leadsCount - alt.leadsCount) / winner.leadsCount) * 100;
      if (gapPct > 0)
        gaps.push({
          label: `fewer total leads (${alt.leadsCount} vs ${winner.leadsCount})`,
          gapPct,
        });
    }

    if (gaps.length === 0)
      return 'Close performance overall, but a lower composite score across the tracked metrics.';
    gaps.sort((a, b) => b.gapPct - a.gapPct);
    return gaps[0].label;
  }

  private buildRecommendationText(
    winner: RawMetrics,
    periodLabel: string | null,
  ): string {
    const name = winner.name;
    const suffix = periodLabel ? ` ${periodLabel}` : '';
    if (winner.status === 'ACTIVE') {
      return `"${name}" was your strongest performer${suffix} — consider scaling its budget further while monitoring conversion quality for the next 3–7 days.`;
    }
    return `Re-launch "${name}" with a controlled budget increase and monitor performance for the first 3–7 days${suffix ? ` (it performed best${suffix})` : ''}.`;
  }
}

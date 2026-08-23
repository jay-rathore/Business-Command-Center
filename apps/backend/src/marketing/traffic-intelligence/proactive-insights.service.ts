import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationProvider, Priority } from '@prisma/client';
import { PRISMA_EXTENDED_CLIENT } from '../../prisma/prisma-extended.provider';
import type { ExtendedPrismaClient } from '../../prisma/prisma-extended.provider';
import { TenantContext } from '../../common/context/tenant-context';
import { IntegrationConnectionsService } from '../../integration-connections/integration-connections.service';
import { RootCauseEngineService } from './root-cause-engine.service';
import { toDateKey } from './analysis/period.util';

export interface ProactiveInsightsRunResult {
  checked: boolean;
  created: boolean;
}

/** Daily digest — checks yesterday for a confirmed traffic anomaly and, if found, writes an
 * AIInsight row (Traffic Intelligence spec §10: proactive insights without the user asking a
 * question). Reuses RootCauseEngineService.confirmDayIsAnomaly + investigate() rather than
 * duplicating any evidence-gathering logic, so a proactive insight and an on-demand /investigate
 * answer for the same date always agree. */
@Injectable()
export class ProactiveInsightsService {
  private readonly logger = new Logger(ProactiveInsightsService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT)
    private readonly prisma: ExtendedPrismaClient,
    private readonly connections: IntegrationConnectionsService,
    private readonly rootCauseEngine: RootCauseEngineService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM) // after the 4am GA4/Search Console syncs, see google-analytics-sync.service.ts
  async scheduledDigest(): Promise<void> {
    const active = await this.connections.listActive(
      IntegrationProvider.GOOGLE_ANALYTICS,
    );
    for (const connection of active) {
      await TenantContext.run(
        { organizationId: connection.organizationId },
        async () => {
          try {
            const result = await this.runForCurrentTenant();
            this.logger.log(
              `Proactive insights digest (org ${connection.organizationId}): anomaly=${result.checked}, created=${result.created}`,
            );
          } catch (err) {
            this.logger.error(
              `Proactive insights digest failed (org ${connection.organizationId}): ${err instanceof Error ? err.message : err}`,
            );
          }
        },
      );
    }
  }

  /** Runs for whichever organization is current in TenantContext — used by both the cron above
   * (one org at a time, inside TenantContext.run) and the manual /run endpoint (already scoped
   * to the requesting user's org by the tenant-context interceptor). */
  async runForCurrentTenant(): Promise<ProactiveInsightsRunResult> {
    const organizationId = TenantContext.get().organizationId;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateKey = toDateKey(yesterday);

    const isAnomaly = await this.rootCauseEngine.confirmDayIsAnomaly(
      organizationId,
      yesterday,
    );
    if (!isAnomaly) return { checked: false, created: false };

    const existing = await this.prisma.aIInsight.findFirst({
      where: {
        organizationId,
        sourceRefModule: 'MARKETING',
        sourceRefId: dateKey,
      },
    });
    if (existing) return { checked: true, created: false };

    const investigation = await this.rootCauseEngine.investigate({
      intent: 'general',
      dateFrom: yesterday,
      dateTo: yesterday,
    });

    const visitorDelta =
      investigation.trafficChange.visitorsAfter -
      investigation.trafficChange.visitorsBefore;

    await this.prisma.aIInsight.create({
      data: {
        organizationId,
        category: 'MARKETING',
        type:
          investigation.trafficChange.direction === 'down'
            ? 'RISK'
            : 'OPPORTUNITY',
        priority: this.derivePriority(
          investigation.confidence.label,
          investigation.trafficChange.percent,
        ),
        headline: investigation.summary,
        whatHappened: `${investigation.trafficChange.visitorsBefore} → ${investigation.trafficChange.visitorsAfter} visitors (${investigation.trafficChange.percent?.toFixed(0) ?? '—'}%), compared with ${investigation.trafficChange.comparedWith}.`,
        whyItHappened:
          investigation.primaryCause?.summary ??
          'No single cause could be confidently identified from connected data.',
        businessImpact: `Approximately ${Math.abs(visitorDelta)} ${visitorDelta >= 0 ? 'more' : 'fewer'} visitors than the previous equivalent period.`,
        recommendedAction: investigation.recommendedAction,
        confidence: investigation.confidence.score,
        sourceRefModule: 'MARKETING',
        sourceRefId: dateKey,
      },
    });

    return { checked: true, created: true };
  }

  /** Explicit, documented priority mapping — not arbitrary: a High-confidence anomaly with a
   * large (>=40%) swing is CRITICAL; either factor alone is HIGH; Medium confidence is MEDIUM;
   * anything else is LOW. */
  private derivePriority(
    confidenceLabel: 'High' | 'Medium' | 'Low',
    percent: number | null,
  ): Priority {
    const magnitude = Math.abs(percent ?? 0);
    if (confidenceLabel === 'High' && magnitude >= 40) return 'CRITICAL';
    if (confidenceLabel === 'High' || magnitude >= 40) return 'HIGH';
    if (confidenceLabel === 'Medium') return 'MEDIUM';
    return 'LOW';
  }
}

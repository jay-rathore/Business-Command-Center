import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { SiteAnalyticsSummary } from '@hpl/shared';
import { IntegrationProvider } from '@prisma/client';
import { PRISMA_EXTENDED_CLIENT } from '../../prisma/prisma-extended.provider';
import type { ExtendedPrismaClient } from '../../prisma/prisma-extended.provider';
import { TenantContext } from '../../common/context/tenant-context';
import { IntegrationConnectionsService } from '../../integration-connections/integration-connections.service';
import type { GoogleAnalyticsCredentials } from '../../integration-connections/credential-types';

const REPORT_DAYS = 30;
const METRICS = [
  'sessions',
  'activeUsers',
  'newUsers',
  'screenPageViews',
  'conversions',
  'engagementRate',
  'averageSessionDuration',
];

export interface GoogleAnalyticsSyncResult {
  processed: number;
  created: number;
  updated: number;
}

function parseReportDate(value: string): Date {
  // GA4 returns dates as "YYYYMMDD"
  return new Date(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
  );
}

/** Pulls daily site metrics from each tenant's own GA4 property (credentials:
 * IntegrationConnection, provider GOOGLE_ANALYTICS) for the trailing 30 days, upserting
 * WebsiteAnalyticsDaily by date — mirrors MetaAdsSyncService/GoogleAdsSyncService in shape. */
@Injectable()
export class GoogleAnalyticsSyncService {
  private readonly logger = new Logger(GoogleAnalyticsSyncService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT)
    private readonly prisma: ExtendedPrismaClient,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledSync(): Promise<void> {
    const active = await this.connections.listActive(
      IntegrationProvider.GOOGLE_ANALYTICS,
    );
    for (const connection of active) {
      await TenantContext.run(
        { organizationId: connection.organizationId },
        async () => {
          try {
            const credentials =
              this.connections.decrypt<GoogleAnalyticsCredentials>(connection);
            const result = await this.syncNow(credentials);
            await this.connections.recordSuccess(connection.id);
            this.logger.log(
              `GA4 sync (org ${connection.organizationId}): ${result.processed} days processed (${result.created} new, ${result.updated} updated)`,
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

  async syncNow(
    credentials: GoogleAnalyticsCredentials,
  ): Promise<GoogleAnalyticsSyncResult> {
    const client = this.getClient(credentials);

    const [response] = await client.runReport({
      property: `properties/${credentials.propertyId}`,
      dateRanges: [{ startDate: `${REPORT_DAYS}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: METRICS.map((name) => ({ name })),
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    const rows = response.rows ?? [];
    const organizationId = TenantContext.get().organizationId;
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const dateValue = row.dimensionValues?.[0]?.value;
      if (!dateValue) continue;
      const date = parseReportDate(dateValue);

      const metricAt = (name: string) =>
        Number(row.metricValues?.[METRICS.indexOf(name)]?.value ?? 0);

      const data = {
        sessions: Math.round(metricAt('sessions')),
        activeUsers: Math.round(metricAt('activeUsers')),
        newUsers: Math.round(metricAt('newUsers')),
        pageViews: Math.round(metricAt('screenPageViews')),
        conversions: Math.round(metricAt('conversions')),
        engagementRate: metricAt('engagementRate'),
        avgSessionSeconds: metricAt('averageSessionDuration'),
      };

      const existing = await this.prisma.websiteAnalyticsDaily.findUnique({
        where: { organizationId_date: { organizationId, date } },
        select: { id: true },
      });
      await this.prisma.websiteAnalyticsDaily.upsert({
        where: { organizationId_date: { organizationId, date } },
        update: data,
        create: { organizationId, date, ...data },
      });
      if (existing) updated++;
      else created++;
    }

    try {
      await this.syncChannelBreakdown(client, credentials, organizationId);
      await this.syncLandingPageBreakdown(client, credentials, organizationId);
    } catch (err) {
      // Non-fatal: site-wide totals above already synced successfully. These breakdowns only
      // feed Traffic Intelligence's root-cause engine, not the existing site-analytics summary.
      this.logger.error(
        `GA4 breakdown sync failed (org ${organizationId}): ${this.errorMessage(err)}`,
      );
    }

    return { processed: rows.length, created, updated };
  }

  /** Sessions by GA4 default channel group (Organic Search, Paid Social, Direct, Referral, ...)
   * per day, upserted into WebsiteChannelDaily — WebsiteAnalyticsDaily above is site-wide totals
   * only, so this is what lets the root-cause engine attribute a traffic change to a channel. */
  private async syncChannelBreakdown(
    client: BetaAnalyticsDataClient,
    credentials: GoogleAnalyticsCredentials,
    organizationId: string,
  ): Promise<void> {
    const [response] = await client.runReport({
      property: `properties/${credentials.propertyId}`,
      dateRanges: [{ startDate: `${REPORT_DAYS}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }, { name: 'conversions' }],
    });

    for (const row of response.rows ?? []) {
      const dateValue = row.dimensionValues?.[0]?.value;
      const channel = row.dimensionValues?.[1]?.value;
      if (!dateValue || !channel) continue;
      const date = parseReportDate(dateValue);
      const data = {
        sessions: Math.round(Number(row.metricValues?.[0]?.value ?? 0)),
        conversions: Math.round(Number(row.metricValues?.[1]?.value ?? 0)),
      };

      await this.prisma.websiteChannelDaily.upsert({
        where: {
          organizationId_date_channel: { organizationId, date, channel },
        },
        update: data,
        create: { organizationId, date, channel, ...data },
      });
    }
  }

  /** Sessions by landing page per day, upserted into WebsiteLandingPageDaily — mirrors
   * SearchConsoleTopQuery's shape, enables "landing page X received 2.4x more traffic" evidence. */
  private async syncLandingPageBreakdown(
    client: BetaAnalyticsDataClient,
    credentials: GoogleAnalyticsCredentials,
    organizationId: string,
  ): Promise<void> {
    const [response] = await client.runReport({
      property: `properties/${credentials.propertyId}`,
      dateRanges: [{ startDate: `${REPORT_DAYS}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'date' }, { name: 'landingPagePlusQueryString' }],
      metrics: [{ name: 'sessions' }],
      limit: 500,
    });

    for (const row of response.rows ?? []) {
      const dateValue = row.dimensionValues?.[0]?.value;
      const landingPage = row.dimensionValues?.[1]?.value;
      if (!dateValue || !landingPage) continue;
      const date = parseReportDate(dateValue);
      const sessions = Math.round(Number(row.metricValues?.[0]?.value ?? 0));

      await this.prisma.websiteLandingPageDaily.upsert({
        where: {
          organizationId_date_landingPage: {
            organizationId,
            date,
            landingPage,
          },
        },
        update: { sessions },
        create: { organizationId, date, landingPage, sessions },
      });
    }
  }

  async getSummary(): Promise<SiteAnalyticsSummary> {
    const rows = await this.prisma.websiteAnalyticsDaily.findMany({
      orderBy: { date: 'asc' },
      take: REPORT_DAYS,
    });

    const totals = rows.reduce(
      (acc, r) => ({
        sessions: acc.sessions + r.sessions,
        activeUsers: acc.activeUsers + r.activeUsers,
        newUsers: acc.newUsers + r.newUsers,
        pageViews: acc.pageViews + r.pageViews,
        conversions: acc.conversions + r.conversions,
      }),
      {
        sessions: 0,
        activeUsers: 0,
        newUsers: 0,
        pageViews: 0,
        conversions: 0,
      },
    );

    return {
      totals,
      series: rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        sessions: r.sessions,
        activeUsers: r.activeUsers,
        conversions: r.conversions,
      })),
    };
  }

  // Deliberately not cached on the instance — this is a singleton provider shared across every
  // tenant's requests, and each tenant now has its own service account credentials.
  private getClient(
    credentials: GoogleAnalyticsCredentials,
  ): BetaAnalyticsDataClient {
    return new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.serviceAccountEmail,
        private_key: credentials.serviceAccountPrivateKey.replace(/\\n/g, '\n'),
      },
    });
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private logError(organizationId: string, err: unknown): void {
    const message = this.errorMessage(err);
    if (
      message.includes('PERMISSION_DENIED') ||
      message.includes('UNAUTHENTICATED')
    ) {
      this.logger.error(
        `GA4 sync failed (org ${organizationId}) — check that the service account has Viewer access on the ` +
          `configured GA4 property. Original error: ${message}`,
      );
      return;
    }
    this.logger.error(`GA4 sync failed (org ${organizationId}): ${message}`);
  }
}

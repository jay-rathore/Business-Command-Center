import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { SiteAnalyticsSummary } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";

const REPORT_DAYS = 30;
const METRICS = ["sessions", "activeUsers", "newUsers", "screenPageViews", "conversions", "engagementRate", "averageSessionDuration"];

export interface GoogleAnalyticsSyncResult {
  processed: number;
  created: number;
  updated: number;
}

function parseReportDate(value: string): Date {
  // GA4 returns dates as "YYYYMMDD"
  return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`);
}

/** Pulls daily site metrics from GA4 for the trailing 30 days, upserting WebsiteAnalyticsDaily by
 * date — mirrors MetaAdsSyncService/GoogleAdsSyncService in shape. Auth is a service account
 * (GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY), shared with SearchConsoleSyncService. */
@Injectable()
export class GoogleAnalyticsSyncService {
  private readonly logger = new Logger(GoogleAnalyticsSyncService.name);
  private client: BetaAnalyticsDataClient | null = null;

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledSync(): Promise<void> {
    try {
      const result = await this.syncNow();
      this.logger.log(`GA4 sync: ${result.processed} days processed (${result.created} new, ${result.updated} updated)`);
    } catch (err) {
      this.logError(err);
    }
  }

  async syncNow(): Promise<GoogleAnalyticsSyncResult> {
    const client = this.getClient();
    const propertyId = this.config.getOrThrow<string>("GA4_PROPERTY_ID");

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${REPORT_DAYS}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: METRICS.map((name) => ({ name })),
      orderBys: [{ dimension: { dimensionName: "date" } }],
    });

    const rows = response.rows ?? [];
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const dateValue = row.dimensionValues?.[0]?.value;
      if (!dateValue) continue;
      const date = parseReportDate(dateValue);

      const metricAt = (name: string) => Number(row.metricValues?.[METRICS.indexOf(name)]?.value ?? 0);

      const data = {
        sessions: Math.round(metricAt("sessions")),
        activeUsers: Math.round(metricAt("activeUsers")),
        newUsers: Math.round(metricAt("newUsers")),
        pageViews: Math.round(metricAt("screenPageViews")),
        conversions: Math.round(metricAt("conversions")),
        engagementRate: metricAt("engagementRate"),
        avgSessionSeconds: metricAt("averageSessionDuration"),
      };

      const existing = await this.prisma.websiteAnalyticsDaily.findUnique({ where: { date }, select: { id: true } });
      await this.prisma.websiteAnalyticsDaily.upsert({ where: { date }, update: data, create: { date, ...data } });
      if (existing) updated++;
      else created++;
    }

    return { processed: rows.length, created, updated };
  }

  async getSummary(): Promise<SiteAnalyticsSummary> {
    const rows = await this.prisma.websiteAnalyticsDaily.findMany({ orderBy: { date: "asc" }, take: REPORT_DAYS });

    const totals = rows.reduce(
      (acc, r) => ({
        sessions: acc.sessions + r.sessions,
        activeUsers: acc.activeUsers + r.activeUsers,
        newUsers: acc.newUsers + r.newUsers,
        pageViews: acc.pageViews + r.pageViews,
        conversions: acc.conversions + r.conversions,
      }),
      { sessions: 0, activeUsers: 0, newUsers: 0, pageViews: 0, conversions: 0 },
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

  private getClient(): BetaAnalyticsDataClient {
    if (!this.client) {
      this.client = new BetaAnalyticsDataClient({
        credentials: {
          client_email: this.config.getOrThrow<string>("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
          private_key: this.config.getOrThrow<string>("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
        },
      });
    }
    return this.client;
  }

  private logError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("PERMISSION_DENIED") || message.includes("UNAUTHENTICATED")) {
      this.logger.error(
        `GA4 sync failed — check that the service account (GOOGLE_SERVICE_ACCOUNT_EMAIL) has Viewer ` +
          `access on GA4 property ${this.config.get<string>("GA4_PROPERTY_ID")}. Original error: ${message}`,
      );
      return;
    }
    this.logger.error(`GA4 sync failed: ${message}`);
  }
}

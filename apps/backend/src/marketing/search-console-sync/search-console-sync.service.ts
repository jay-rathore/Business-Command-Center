import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { google } from "googleapis";
import { SearchConsoleSummary } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";

const REPORT_DAYS = 30;
const FRESHNESS_LAG_DAYS = 3; // Search Console data typically isn't final until ~2-3 days after the fact
const TOP_QUERY_LIMIT = 20;

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pulls site-wide daily totals + a top-queries snapshot from Search Console, upserting
 * SearchConsoleDaily (by date) and SearchConsoleTopQuery (by date+query) — mirrors
 * GoogleAnalyticsSyncService in shape. Shares the same service account credentials as GA4; the
 * account must be added as a user under the property's Settings → Users and permissions. */
@Injectable()
export class SearchConsoleSyncService {
  private readonly logger = new Logger(SearchConsoleSyncService.name);
  private searchconsole: ReturnType<typeof google.searchconsole> | null = null;

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledSync(): Promise<void> {
    try {
      const result = await this.syncNow();
      this.logger.log(`Search Console sync: ${result.dailyRows} daily rows, ${result.topQueries} top queries`);
    } catch (err) {
      this.logError(err);
    }
  }

  async syncNow(): Promise<{ dailyRows: number; topQueries: number }> {
    const client = this.getClient();
    const siteUrl = this.config.getOrThrow<string>("SEARCH_CONSOLE_SITE_URL");

    const end = new Date();
    end.setDate(end.getDate() - FRESHNESS_LAG_DAYS);
    const start = new Date(end);
    start.setDate(start.getDate() - REPORT_DAYS);

    const [dailyRes, topQueryRes] = await Promise.all([
      client.searchanalytics.query({
        siteUrl,
        requestBody: { startDate: toDateString(start), endDate: toDateString(end), dimensions: ["date"], rowLimit: REPORT_DAYS + 1 },
      }),
      client.searchanalytics.query({
        siteUrl,
        requestBody: { startDate: toDateString(start), endDate: toDateString(end), dimensions: ["query"], rowLimit: TOP_QUERY_LIMIT * 5 },
      }),
    ]);

    let dailyRows = 0;
    for (const row of dailyRes.data.rows ?? []) {
      const dateKey = row.keys?.[0];
      if (!dateKey) continue;
      const date = new Date(dateKey);
      const data = { clicks: Math.round(row.clicks ?? 0), impressions: Math.round(row.impressions ?? 0), ctr: row.ctr ?? 0, position: row.position ?? 0 };
      await this.prisma.searchConsoleDaily.upsert({ where: { date }, update: data, create: { date, ...data } });
      dailyRows++;
    }

    const topQueries = (topQueryRes.data.rows ?? [])
      .slice()
      .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0))
      .slice(0, TOP_QUERY_LIMIT);

    for (const row of topQueries) {
      const query = row.keys?.[0];
      if (!query) continue;
      const data = { clicks: Math.round(row.clicks ?? 0), impressions: Math.round(row.impressions ?? 0), ctr: row.ctr ?? 0, position: row.position ?? 0 };
      await this.prisma.searchConsoleTopQuery.upsert({
        where: { date_query: { date: end, query } },
        update: data,
        create: { date: end, query, ...data },
      });
    }

    return { dailyRows, topQueries: topQueries.length };
  }

  async getSummary(): Promise<SearchConsoleSummary> {
    const [dailyRows, latestQueries] = await Promise.all([
      this.prisma.searchConsoleDaily.findMany({ orderBy: { date: "asc" }, take: REPORT_DAYS }),
      this.prisma.searchConsoleTopQuery.findMany({ orderBy: [{ date: "desc" }, { clicks: "desc" }], take: TOP_QUERY_LIMIT }),
    ]);

    const totals = dailyRows.reduce(
      (acc, r) => ({
        clicks: acc.clicks + r.clicks,
        impressions: acc.impressions + r.impressions,
        ctr: acc.ctr,
        position: acc.position,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    );
    totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    totals.position = dailyRows.length > 0 ? dailyRows.reduce((s, r) => s + Number(r.position), 0) / dailyRows.length : 0;

    return {
      totals,
      series: dailyRows.map((r) => ({ date: r.date.toISOString().slice(0, 10), clicks: r.clicks, impressions: r.impressions })),
      topQueries: latestQueries.map((q) => ({
        query: q.query,
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: Number(q.ctr),
        position: Number(q.position),
      })),
    };
  }

  private getClient() {
    if (!this.searchconsole) {
      const auth = new google.auth.JWT({
        email: this.config.getOrThrow<string>("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
        key: this.config.getOrThrow<string>("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      });
      this.searchconsole = google.searchconsole({ version: "v1", auth });
    }
    return this.searchconsole;
  }

  private logError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("403") || message.includes("PERMISSION_DENIED") || message.includes("not verified")) {
      this.logger.error(
        `Search Console sync failed — check that the service account (GOOGLE_SERVICE_ACCOUNT_EMAIL) is added as a ` +
          `user on ${this.config.get<string>("SEARCH_CONSOLE_SITE_URL")} under Settings → Users and permissions. Original error: ${message}`,
      );
      return;
    }
    this.logger.error(`Search Console sync failed: ${message}`);
  }
}

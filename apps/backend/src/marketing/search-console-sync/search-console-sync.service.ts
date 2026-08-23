import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { google } from "googleapis";
import { SearchConsoleSummary } from "@hpl/shared";
import { IntegrationProvider } from "@prisma/client";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";
import { TenantContext } from "../../common/context/tenant-context";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { SearchConsoleCredentials } from "../../integration-connections/credential-types";

const REPORT_DAYS = 30;
const FRESHNESS_LAG_DAYS = 3; // Search Console data typically isn't final until ~2-3 days after the fact
const TOP_QUERY_LIMIT = 20;

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pulls site-wide daily totals + a top-queries snapshot from each tenant's own Search Console
 * property (credentials: IntegrationConnection, provider SEARCH_CONSOLE), upserting
 * SearchConsoleDaily (by date) and SearchConsoleTopQuery (by date+query) — mirrors
 * GoogleAnalyticsSyncService in shape. The configured service account must be added as a user
 * on that site under Search Console's Settings → Users and permissions. */
@Injectable()
export class SearchConsoleSyncService {
  private readonly logger = new Logger(SearchConsoleSyncService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledSync(): Promise<void> {
    const active = await this.connections.listActive(IntegrationProvider.SEARCH_CONSOLE);
    for (const connection of active) {
      await TenantContext.run({ organizationId: connection.organizationId }, async () => {
        try {
          const credentials = this.connections.decrypt<SearchConsoleCredentials>(connection);
          const result = await this.syncNow(credentials);
          await this.connections.recordSuccess(connection.id);
          this.logger.log(
            `Search Console sync (org ${connection.organizationId}): ${result.dailyRows} daily rows, ${result.topQueries} top queries`,
          );
        } catch (err) {
          await this.connections.recordError(connection.id, this.errorMessage(err));
          this.logError(connection.organizationId, err);
        }
      });
    }
  }

  async syncNow(credentials: SearchConsoleCredentials): Promise<{ dailyRows: number; topQueries: number }> {
    const client = this.getClient(credentials);
    const siteUrl = credentials.siteUrl;

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

    const organizationId = TenantContext.get().organizationId;
    let dailyRows = 0;
    for (const row of dailyRes.data.rows ?? []) {
      const dateKey = row.keys?.[0];
      if (!dateKey) continue;
      const date = new Date(dateKey);
      const data = { clicks: Math.round(row.clicks ?? 0), impressions: Math.round(row.impressions ?? 0), ctr: row.ctr ?? 0, position: row.position ?? 0 };
      await this.prisma.searchConsoleDaily.upsert({
        where: { organizationId_date: { organizationId, date } },
        update: data,
        create: { organizationId, date, ...data },
      });
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
        where: { organizationId_date_query: { organizationId, date: end, query } },
        update: data,
        create: { organizationId, date: end, query, ...data },
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

  // Deliberately not cached on the instance — this is a singleton provider shared across every
  // tenant's requests, and each tenant now has its own service account credentials.
  private getClient(credentials: SearchConsoleCredentials) {
    const auth = new google.auth.JWT({
      email: credentials.serviceAccountEmail,
      key: credentials.serviceAccountPrivateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    return google.searchconsole({ version: "v1", auth });
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private logError(organizationId: string, err: unknown): void {
    const message = this.errorMessage(err);
    if (message.includes("403") || message.includes("PERMISSION_DENIED") || message.includes("not verified")) {
      this.logger.error(
        `Search Console sync failed (org ${organizationId}) — check that the configured service account is added ` +
          `as a user on the site under Settings → Users and permissions. Original error: ${message}`,
      );
      return;
    }
    this.logger.error(`Search Console sync failed (org ${organizationId}): ${message}`);
  }
}

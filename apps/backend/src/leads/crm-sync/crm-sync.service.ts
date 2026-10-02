import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IntegrationProvider, NotificationType, PermissionModule, Priority, RoleName } from "@prisma/client";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";
import { TenantContext } from "../../common/context/tenant-context";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { HplCrmCredentials } from "../../integration-connections/credential-types";
import { NotificationsService } from "../../notifications/notifications.service";
import { computeLeadScore } from "../lead-scoring.util";
import { classifyStatusName, CRM_STATUS_EXCLUDED_DEPARTMENTS } from "./crm-status-classification";
import { CrmLeadRaw, CrmLookupRow, mapCrmLead, mapCrmRep } from "./crm-lead-mapper";

// ₹20L — same "high-value" framing AttentionFeedService/NotificationsService use elsewhere.
const HIGH_VALUE_THRESHOLD = 2000000;

interface CrmLeadListResponse {
  count: number;
  results: CrmLeadRaw[];
  next: string | null;
}

export interface CrmSyncResult {
  processed: number;
  created: number;
  updated: number;
}

/** Keeps hpl-command-center's leads current with the HPL CRM (apiuatcrm.ultracreation.in), one
 * tenant at a time, via its own IntegrationConnection (provider HPL_CRM) — same pattern as
 * MetaAdsSyncService/GoogleAdsSyncService, not a hardcoded single-tenant env var anymore (see
 * migrate-env-to-connections.ts for how HPL Maker's own credentials got moved in).
 *
 * Two sync modes:
 *  - syncRecent (the scheduled one, every 30 min): polls a rolling recent window
 *    (`created_at_after`) — cheap, catches new leads and status/detail changes on RECENTLY
 *    CREATED leads. The CRM's list API only exposes date-level `created_at_after`, not a
 *    precise `updated_at` filter (as of this writing), so this can't cheaply catch a change on
 *    a lead created outside the window.
 *  - fullResync (manual/on-demand): walks every page with no date filter, upserting everything.
 *    Slower, but closes any drift syncRecent's window structurally can't reach — e.g. a status
 *    change on an old lead, or a gap left by the sync having been broken for a while (which is
 *    exactly what happened before this connection was reconnected — see the HPL_CRM connection's
 *    lastSyncError history for that incident).
 *
 * Shares its field-mapping and status-classification logic with the one-time backfill
 * (prisma/import-crm-snapshot.ts) via crm-lead-mapper.ts / crm-status-classification.ts, so
 * there is exactly one place that logic lives. */
@Injectable()
export class CrmSyncService {
  private readonly logger = new Logger(CrmSyncService.name);

  private readonly statusCache = new Map<number, string | null>();
  private readonly sourceCache = new Map<number, string>();
  private readonly typeCache = new Map<number, string>();
  private readonly repCache = new Map<number, string>();

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly connections: IntegrationConnectionsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledSync(): Promise<void> {
    const active = await this.connections.listActive(IntegrationProvider.HPL_CRM);
    for (const connection of active) {
      await TenantContext.run({ organizationId: connection.organizationId }, async () => {
        try {
          const credentials = this.connections.decrypt<HplCrmCredentials>(connection);
          const result = await this.syncRecent(credentials);
          await this.connections.recordSuccess(connection.id);
          this.logger.log(
            `CRM sync (org ${connection.organizationId}): ${result.processed} leads processed (${result.created} new, ${result.updated} updated)`,
          );
        } catch (err) {
          await this.connections.recordError(connection.id, this.errorMessage(err));
          this.logger.error(`CRM sync failed (org ${connection.organizationId}): ${this.errorMessage(err)}`);
        }
      });
    }
  }

  /** Pulls leads created in the last `daysBack` days and upserts them. Small, bounded result
   * set per run — not a re-scrape of the full CRM. */
  async syncRecent(credentials: HplCrmCredentials, daysBack = 3): Promise<CrmSyncResult> {
    const afterDate = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    const startUrl = `${credentials.baseUrl}/api/leads/?action=1&page_size=100&created_at_after=${afterDate}`;
    return this.runSync(startUrl, credentials.token);
  }

  /** Walks every page of /api/leads/ with no date filter, upserting everything. Use for the
   * initial cutover onto this connection, for recovering from a sync outage, or periodically as
   * a drift backstop — see the class doc for why syncRecent alone can't self-heal that drift. */
  async fullResync(credentials: HplCrmCredentials): Promise<CrmSyncResult> {
    const startUrl = `${credentials.baseUrl}/api/leads/?action=1&page_size=100`;
    return this.runSync(startUrl, credentials.token);
  }

  private async runSync(startUrl: string, token: string): Promise<CrmSyncResult> {
    let url: string | null = startUrl;
    let processed = 0;
    let created = 0;
    let updated = 0;

    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
      if (!res.ok) throw new Error(`HPL CRM API returned ${res.status} for ${url}`);
      const data = (await res.json()) as CrmLeadListResponse;

      const organizationId = TenantContext.get().organizationId;
      for (const raw of data.results) {
        const existed = await this.prisma.lead.findUnique({
          where: { organizationId_crmId: { organizationId, crmId: raw.id } },
          select: { id: true },
        });
        await this.upsertLead(raw);
        processed++;
        if (existed) updated++;
        else created++;
      }
      url = data.next;
    }

    return { processed, created, updated };
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private async upsertLead(raw: CrmLeadRaw): Promise<void> {
    const mapped = mapCrmLead(raw);
    const statusId = raw.status_detail ? await this.ensureStatus(raw.status_detail) : null;
    const leadTypeId = raw.type_detail ? await this.ensureSimpleLookup("leadType", this.typeCache, raw.type_detail) : null;
    const assignedExecId = raw.assigned_to ? await this.ensureRep(raw.assigned_to.user) : null;

    const sourceIds: string[] = [];
    for (const detail of raw.source_detail ?? []) {
      sourceIds.push(await this.ensureSimpleLookup("leadSource", this.sourceCache, detail));
    }

    const status = statusId ? await this.prisma.leadStatus.findUnique({ where: { id: statusId } }) : null;
    const sourceRows = sourceIds.length > 0 ? await this.prisma.leadSource.findMany({ where: { id: { in: sourceIds } } }) : [];
    const daysSinceActivity = Math.round((Date.now() - mapped.lastActivityAt.getTime()) / 86400000);
    const score = computeLeadScore({
      sourceScores: sourceRows.map((s) => s.score),
      statusScore: status?.score ?? null,
      isLost: status?.stage === "LOST",
      estimatedValue: mapped.estimatedValue,
      daysSinceActivity,
    });

    const commonData = {
      name: mapped.name,
      company: mapped.company,
      phone: mapped.phone,
      email: mapped.email,
      state: mapped.state,
      city: mapped.city,
      leadTypeId,
      assignedExecId,
      statusId,
      estimatedValue: mapped.estimatedValue,
      notes: mapped.notes,
      lastActivityAt: mapped.lastActivityAt,
      wonAt: status?.stage === "WON" ? mapped.lastActivityAt : null,
      lostAt: status?.stage === "LOST" ? mapped.lastActivityAt : null,
      score,
    };

    const organizationId = TenantContext.get().organizationId;
    const existed = await this.prisma.lead.findUnique({
      where: { organizationId_crmId: { organizationId, crmId: mapped.crmId } },
      select: { id: true },
    });
    const lead = await this.prisma.lead.upsert({
      where: { organizationId_crmId: { organizationId, crmId: mapped.crmId } },
      update: commonData,
      create: { organizationId, crmId: mapped.crmId, leadCode: mapped.leadCode, createdAt: mapped.createdAt, ...commonData },
    });

    if (!existed) {
      await this.notifications.notify({
        organizationId,
        type: NotificationType.NEW_LEAD,
        priority: Priority.MEDIUM,
        title: `New lead: ${lead.name}`,
        message: `${lead.city}, ${lead.state}`,
        linkModule: PermissionModule.LEADS,
        linkRecordId: lead.id,
        targetRole: RoleName.SALES_MANAGER,
      });
      if (mapped.estimatedValue !== null && mapped.estimatedValue >= HIGH_VALUE_THRESHOLD) {
        await this.notifications.notify({
          organizationId,
          type: NotificationType.HIGH_VALUE_LEAD,
          priority: Priority.HIGH,
          title: `High-value lead: ${lead.name}`,
          message: `Estimated value ₹${mapped.estimatedValue.toLocaleString("en-IN")}`,
          linkModule: PermissionModule.LEADS,
          linkRecordId: lead.id,
          targetRole: RoleName.SALES_MANAGER,
        });
      }
    }

    // Sources can change between polls — simplest correct approach at this volume is replace-in-full.
    await this.prisma.leadSourceOnLead.deleteMany({ where: { leadId: lead.id } });
    if (sourceIds.length > 0) {
      await this.prisma.leadSourceOnLead.createMany({
        data: sourceIds.map((leadSourceId) => ({ organizationId, leadId: lead.id, leadSourceId })),
        skipDuplicates: true,
      });
    }
  }

  private async ensureStatus(detail: CrmLookupRow): Promise<string | null> {
    if (CRM_STATUS_EXCLUDED_DEPARTMENTS.has(detail.department_name ?? "")) return null;
    if (this.statusCache.has(detail.id)) return this.statusCache.get(detail.id)!;

    const organizationId = TenantContext.get().organizationId;
    let row = await this.prisma.leadStatus.findUnique({ where: { organizationId_crmId: { organizationId, crmId: detail.id } } });
    if (!row) row = await this.prisma.leadStatus.findUnique({ where: { organizationId_name: { organizationId, name: detail.name } } });
    if (!row) {
      const { stage, sortOrder } = classifyStatusName(detail.name);
      row = await this.prisma.leadStatus.create({ data: { organizationId, crmId: detail.id, name: detail.name, stage, sortOrder } });
    }
    this.statusCache.set(detail.id, row.id);
    return row.id;
  }

  private async ensureSimpleLookup(
    model: "leadSource" | "leadType",
    cache: Map<number, string>,
    detail: CrmLookupRow,
  ): Promise<string> {
    if (cache.has(detail.id)) return cache.get(detail.id)!;

    const organizationId = TenantContext.get().organizationId;
    const client = this.prisma[model] as unknown as {
      findUnique: (args: unknown) => Promise<{ id: string } | null>;
      create: (args: unknown) => Promise<{ id: string }>;
    };
    let row = await client.findUnique({ where: { organizationId_crmId: { organizationId, crmId: detail.id } } });
    if (!row) row = await client.findUnique({ where: { organizationId_name: { organizationId, name: detail.name } } });
    if (!row) row = await client.create({ data: { organizationId, crmId: detail.id, name: detail.name } });
    cache.set(detail.id, row.id);
    return row.id;
  }

  private async ensureRep(user: Parameters<typeof mapCrmRep>[0]): Promise<string> {
    if (this.repCache.has(user.id)) return this.repCache.get(user.id)!;

    const organizationId = TenantContext.get().organizationId;
    const rep = mapCrmRep(user);
    const row = await this.prisma.salesExecutive.upsert({
      where: { organizationId_employeeCode: { organizationId, employeeCode: rep.employeeCode } },
      update: { name: rep.name, email: rep.email },
      create: { organizationId, employeeCode: rep.employeeCode, name: rep.name, email: rep.email, designation: "Sales Executive" },
    });
    this.repCache.set(user.id, row.id);
    return row.id;
  }
}

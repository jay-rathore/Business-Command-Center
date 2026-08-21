import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";
import { computeLeadScore } from "../lead-scoring.util";
import { classifyStatusName, CRM_STATUS_EXCLUDED_DEPARTMENTS } from "./crm-status-classification";
import { CrmLeadRaw, CrmLookupRow, mapCrmLead, mapCrmRep } from "./crm-lead-mapper";

interface CrmLeadListResponse {
  results: CrmLeadRaw[];
  next: string | null;
}

export interface CrmSyncResult {
  processed: number;
  created: number;
  updated: number;
}

/** Keeps hpl-command-center's leads current with the HPL CRM (apiuatcrm.ultracreation.in)
 * WITHOUT re-pulling the full dataset: polls a rolling recent window (the CRM's list API only
 * exposes date-level `created_at_after`, not `updated_at`, so re-fetching the last few days
 * on every run is the practical way to also catch status/detail changes on recent leads, not
 * just brand-new ones). Shares its field-mapping and status-classification logic with the
 * one-time backfill (prisma/import-crm-snapshot.ts) via crm-lead-mapper.ts /
 * crm-status-classification.ts, so there is exactly one place that logic lives. */
@Injectable()
export class CrmSyncService {
  private readonly logger = new Logger(CrmSyncService.name);

  private readonly statusCache = new Map<number, string | null>();
  private readonly sourceCache = new Map<number, string>();
  private readonly typeCache = new Map<number, string>();
  private readonly repCache = new Map<number, string>();

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledSync(): Promise<void> {
    try {
      const result = await this.syncRecent();
      this.logger.log(`CRM sync: ${result.processed} leads processed (${result.created} new, ${result.updated} updated)`);
    } catch (err) {
      this.logger.error(`CRM sync failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Pulls leads created in the last `daysBack` days and upserts them. Small, bounded result
   * set per run — not a re-scrape of the full CRM. */
  async syncRecent(daysBack = 3): Promise<CrmSyncResult> {
    const baseUrl = this.config.getOrThrow<string>("HPL_CRM_API_BASE_URL");
    const token = this.config.getOrThrow<string>("HPL_CRM_API_TOKEN");
    const afterDate = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

    let url: string | null = `${baseUrl}/api/leads/?action=1&page_size=100&created_at_after=${afterDate}`;
    let processed = 0;
    let created = 0;
    let updated = 0;

    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
      if (!res.ok) throw new Error(`HPL CRM API returned ${res.status} for ${url}`);
      const data = (await res.json()) as CrmLeadListResponse;

      for (const raw of data.results) {
        const existed = await this.prisma.lead.findUnique({ where: { crmId: raw.id }, select: { id: true } });
        await this.upsertLead(raw);
        processed++;
        if (existed) updated++;
        else created++;
      }
      url = data.next;
    }

    return { processed, created, updated };
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

    const lead = await this.prisma.lead.upsert({
      where: { crmId: mapped.crmId },
      update: commonData,
      create: { crmId: mapped.crmId, leadCode: mapped.leadCode, createdAt: mapped.createdAt, ...commonData },
    });

    // Sources can change between polls — simplest correct approach at this volume is replace-in-full.
    await this.prisma.leadSourceOnLead.deleteMany({ where: { leadId: lead.id } });
    if (sourceIds.length > 0) {
      await this.prisma.leadSourceOnLead.createMany({
        data: sourceIds.map((leadSourceId) => ({ leadId: lead.id, leadSourceId })),
        skipDuplicates: true,
      });
    }
  }

  private async ensureStatus(detail: CrmLookupRow): Promise<string | null> {
    if (CRM_STATUS_EXCLUDED_DEPARTMENTS.has(detail.department_name ?? "")) return null;
    if (this.statusCache.has(detail.id)) return this.statusCache.get(detail.id)!;

    let row = await this.prisma.leadStatus.findUnique({ where: { crmId: detail.id } });
    if (!row) row = await this.prisma.leadStatus.findUnique({ where: { name: detail.name } });
    if (!row) {
      const { stage, sortOrder } = classifyStatusName(detail.name);
      row = await this.prisma.leadStatus.create({ data: { crmId: detail.id, name: detail.name, stage, sortOrder } });
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

    const client = this.prisma[model] as unknown as {
      findUnique: (args: unknown) => Promise<{ id: string } | null>;
      create: (args: unknown) => Promise<{ id: string }>;
    };
    let row = await client.findUnique({ where: { crmId: detail.id } });
    if (!row) row = await client.findUnique({ where: { name: detail.name } });
    if (!row) row = await client.create({ data: { crmId: detail.id, name: detail.name } });
    cache.set(detail.id, row.id);
    return row.id;
  }

  private async ensureRep(user: Parameters<typeof mapCrmRep>[0]): Promise<string> {
    if (this.repCache.has(user.id)) return this.repCache.get(user.id)!;

    const rep = mapCrmRep(user);
    const row = await this.prisma.salesExecutive.upsert({
      where: { employeeCode: rep.employeeCode },
      update: { name: rep.name, email: rep.email },
      create: { employeeCode: rep.employeeCode, name: rep.name, email: rep.email, designation: "Sales Executive" },
    });
    this.repCache.set(user.id, row.id);
    return row.id;
  }
}

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, PermissionModule, Priority, Prisma, RoleName } from "@prisma/client";
import {
  BusinessCardDraft,
  DuplicateLeadMatch,
  ExecutiveOption,
  FunnelStage,
  LeadOutcomes,
  LeadSourcePerformance,
  LeadSourcePerformanceRow,
  SourceRating,
  LeadDetail,
  LeadListItem,
  LeadsKpis,
  LeadStatusOption,
  LeadTypeOption,
  PaginatedResponse,
  SourceBreakdownEntry,
} from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { startOfMonth } from "../common/utils/date";
import { FUNNEL_STAGES } from "./crm-sync/crm-status-classification";
import { dateRangeWhere, endOfDay, parseDateOnly } from "../common/utils/date-range.util";
import { LeadsListQueryDto } from "./dto/leads-list-query.dto";
import { CreateLeadActivityDto } from "./dto/create-activity.dto";
import { ScanBusinessCardDto } from "./dto/scan-business-card.dto";
import { CreateLeadFromCardDto } from "./dto/create-lead-from-card.dto";
import { LeadScoringService } from "./lead-scoring.service";
import { BusinessCardAiParserService } from "./business-card-ai-parser.service";
import { BusinessCardImageService } from "./business-card-image.service";
import { LeadCodingService } from "./lead-coding.service";
import { NotificationsService } from "../notifications/notifications.service";

const BUSINESS_CARD_SOURCE_NAME = "Business Card Scan";

type LeadWithRelations = Prisma.LeadGetPayload<{
  include: { assignedExec: true; status: true; leadType: true; sources: { include: { leadSource: true } } };
}>;

const LEAD_LIST_INCLUDE = {
  assignedExec: true,
  status: true,
  leadType: true,
  sources: { include: { leadSource: true } },
} satisfies Prisma.LeadInclude;

const MIN_SOURCE_LEADS = 30;
const MIN_SOURCE_CONTACT_RATE = 50; // percent

/** Strong: clearly more interest than the pipeline average and no more losses. Weak: far less interest, or
 * clearly more losses. Mostly-untouched sources are "unworked". Anything small is "low_volume" - a handful of leads says nothing about a source. */
function rateSource(row: LeadSourcePerformanceRow, base: LeadSourcePerformance["baseline"]): SourceRating {
  if (row.leads < MIN_SOURCE_LEADS) return "low_volume";
  // Judging interest/losses of a source whose leads mostly haven't been touched would blame the source
  // for the team's backlog - flag the backlog instead.
  if ((row.contactRate ?? 0) < MIN_SOURCE_CONTACT_RATE) return "unworked";
  const interest = row.interestRate ?? 0;
  const lost = row.lostRate ?? 0;
  const baseInterest = base.interestRate ?? 0;
  const baseLost = base.lostRate ?? 0;
  if (interest >= baseInterest * 1.25 && lost <= baseLost) return "strong";
  if (interest <= baseInterest * 0.6 || lost >= baseLost * 1.15) return "weak";
  return "average";
}

@Injectable()
export class LeadsService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly scoring: LeadScoringService,
    private readonly cardParser: BusinessCardAiParserService,
    private readonly cardImages: BusinessCardImageService,
    private readonly coding: LeadCodingService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(query: LeadsListQueryDto): Promise<PaginatedResponse<LeadListItem>> {
    const { page, pageSize, sortBy, sortDir, q, statusId, stage, sourceId, dateFrom, dateTo } = query;

    const where: Prisma.LeadWhereInput = {
      ...(statusId ? { statusId } : {}),
      ...(stage ? { status: { stage } } : {}),
      ...(sourceId ? { sources: { some: { leadSourceId: sourceId } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { company: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...dateRangeWhere("createdAt", dateFrom, dateTo),
    };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: LEAD_LIST_INCLUDE,
        orderBy: this.mapSort(sortBy, sortDir),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return buildPaginatedResponse(leads.map((l) => this.toListItem(l)), total, page, pageSize);
  }

  async findOne(id: string): Promise<LeadDetail> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        ...LEAD_LIST_INCLUDE,
        activities: { include: { performedBy: true }, orderBy: { occurredAt: "desc" } },
      },
    });
    if (!lead) throw new NotFoundException("Lead not found");

    return {
      ...this.toListItem(lead),
      notes: lead.notes,
      lostReason: lead.lostReason,
      address: lead.address,
      website: lead.website,
      hasBusinessCardImage: !!lead.businessCardImagePath,
      activities: lead.activities.map((a) => ({
        id: a.id,
        type: a.type,
        note: a.note,
        performedByName: a.performedBy?.name ?? null,
        occurredAt: a.occurredAt.toISOString(),
      })),
    };
  }

  async countOverdue(): Promise<number> {
    return this.prisma.lead.count({
      where: {
        nextFollowUpAt: { lt: new Date() },
        OR: [{ statusId: null }, { status: { stage: { notIn: ["WON", "LOST"] } } }],
      },
    });
  }

  async getKpis(dateFrom?: string, dateTo?: string): Promise<LeadsKpis> {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const range = dateRangeWhere("createdAt", dateFrom, dateTo);

    const [total, newThisMonth, qualified, won, lost] = await Promise.all([
      this.prisma.lead.count({ where: range }),
      this.prisma.lead.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.lead.count({ where: { ...range, status: { name: { equals: "Qualified", mode: "insensitive" } } } }),
      this.prisma.lead.count({ where: { ...range, status: { stage: "WON" } } }),
      this.prisma.lead.count({ where: { ...range, status: { stage: "LOST" } } }),
    ]);

    const pending = total - won - lost;
    const decided = won + lost;

    return {
      totalLeads: total,
      newThisMonth,
      qualified,
      pending,
      won,
      lost,
      conversionRate: decided > 0 ? (won / decided) * 100 : 0,
    };
  }

  async getFunnel(dateFrom?: string, dateTo?: string): Promise<FunnelStage[]> {
    const statuses = await this.prisma.leadStatus.findMany({ where: { isActive: true, stage: { in: ["OPEN", "WON"] } } });
    const range = dateRangeWhere("createdAt", dateFrom, dateTo);

    const [total, counts] = await Promise.all([
      this.prisma.lead.count({ where: range }),
      this.prisma.lead.groupBy({
        by: ["statusId"],
        where: { statusId: { in: statuses.map((s) => s.id) }, ...range },
        _count: { _all: true },
      }),
    ]);
    const countByStatusId = new Map(counts.map((c) => [c.statusId, c._count._all]));

    // First bar: every lead in range, so the funnel reconciles with the "Total Leads" card (lost leads
    // included). The stage bars after it count leads currently in an open/won status at that stage or later.
    const stages: FunnelStage[] = [{ label: "All leads", count: total, statuses: [] }];
    FUNNEL_STAGES.forEach((stage, idx) => {
      const laterOrders = new Set(FUNNEL_STAGES.slice(idx).flatMap((st) => st.sortOrders));
      stages.push({
        label: stage.label,
        count: statuses.filter((st) => laterOrders.has(st.sortOrder)).reduce((sum, st) => sum + (countByStatusId.get(st.id) ?? 0), 0),
        statuses: statuses.filter((st) => stage.sortOrders.includes(st.sortOrder)).map((st) => st.name),
      });
    });
    return stages;
  }

  /** Resolves a lead's current status to its outcome bucket key ("New", "Contacted", ..., "won", "lost",
   * "other") - shared by the outcomes panel and the per-source performance table so they always agree. */
  private async getBucketResolver() {
    const statuses = await this.prisma.leadStatus.findMany();
    const statusById = new Map(statuses.map((s) => [s.id, s]));
    const bucketOf = (statusId: string | null): string => {
      const st = statusId ? statusById.get(statusId) : undefined;
      if (!st || !st.isActive) return "other"; // no status, or a hidden HR/junk status
      if (st.stage === "LOST") return "lost";
      if (st.stage === "WON") return "won";
      const stage = FUNNEL_STAGES.find((f) => f.sortOrders.includes(st.sortOrder));
      return stage ? stage.label : "other";
    };
    return { statusById, bucketOf };
  }

  /** Every lead in range lands in exactly one bucket (by its CURRENT status), so the counts add up to
   * the total — "how many came in, how many were worked, how many were lost and why". */
  async getOutcomes(dateFrom?: string, dateTo?: string): Promise<LeadOutcomes> {
    const range = dateRangeWhere("createdAt", dateFrom, dateTo);
    const [{ statusById, bucketOf }, counts] = await Promise.all([
      this.getBucketResolver(),
      this.prisma.lead.groupBy({ by: ["statusId"], where: range, _count: { _all: true } }),
    ]);

    const defs: { key: string; label: string; stage?: "WON" | "LOST" }[] = [
      ...FUNNEL_STAGES.filter((f) => f.label !== "Won").map((f) => ({ key: f.label, label: f.label === "New" ? "New (not yet worked)" : f.label })),
      { key: "won", label: "Won", stage: "WON" },
      { key: "lost", label: "Lost", stage: "LOST" },
      { key: "other", label: "Other / unclassified" },
    ];
    const buckets = new Map(defs.map((d) => [d.key, { ...d, count: 0, byStatus: new Map<string, number>() }]));

    let total = 0;
    for (const row of counts) {
      const n = row._count._all;
      total += n;
      const b = buckets.get(bucketOf(row.statusId))!;
      b.count += n;
      const name = row.statusId ? statusById.get(row.statusId)?.name ?? "Unknown" : "No status";
      b.byStatus.set(name, (b.byStatus.get(name) ?? 0) + n);
    }

    const count = (key: string) => buckets.get(key)!.count;
    const worked = total - count("New") - count("other"); // anything past "New", lost included
    const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);
    const interested = count("Interested") + count("Qualified") + count("won");
    const decided = count("won") + count("lost");

    return {
      total,
      buckets: defs.map((d) => {
        const b = buckets.get(d.key)!;
        return {
          key: d.key === "won" || d.key === "lost" || d.key === "other" ? d.key : d.key.toLowerCase().replace(/[^a-z]+/g, "_"),
          label: d.label,
          count: b.count,
          pctOfTotal: total > 0 ? (b.count / total) * 100 : 0,
          ...(d.stage ? { stage: d.stage } : {}),
          statuses: [...b.byStatus].map(([name, c]) => ({ name, count: c })).sort((x, y) => y.count - x.count),
        };
      }),
      rates: [
        { key: "contact", label: "Contact rate", value: pct(worked, total), description: "Leads the team has worked (anything past New, lost included) ÷ all leads" },
        { key: "interest", label: "Interest rate", value: pct(interested, worked), description: "Interested + Qualified + Won ÷ worked leads" },
        { key: "lost", label: "Lost rate", value: pct(count("lost"), total), description: "Lost leads ÷ all leads" },
        { key: "lostOfWorked", label: "Lost of worked", value: pct(count("lost"), worked), description: "Lost leads ÷ worked leads" },
        { key: "won", label: "Won rate", value: pct(count("won"), total), description: "Won leads ÷ all leads" },
        { key: "win", label: "Win rate (decided)", value: pct(count("won"), decided), description: "Won ÷ (Won + Lost) — same as the Conversion Rate card" },
      ],
    };
  }

  /** Per-source outcomes: how many leads each source brought, how many got worked / turned interested /
   * won / lost, and a rating against the whole pipeline's rates. Raw SQL because Prisma can't group a
   * join table by the lead's status; org + soft-delete are filtered by hand (raw SQL bypasses the extensions). */
  async getSourcePerformance(dateFrom?: string, dateTo?: string): Promise<LeadSourcePerformance> {
    const from = dateFrom ? parseDateOnly(dateFrom) : null;
    const to = dateTo ? endOfDay(parseDateOnly(dateTo)) : null;
    const organizationId = TenantContext.get().organizationId;

    const [{ statusById, bucketOf }, rows, overall] = await Promise.all([
      this.getBucketResolver(),
      this.prisma.$queryRaw<{ sourceId: string | null; source: string | null; statusId: string | null; n: number }[]>`
        SELECT s."id" AS "sourceId", s."name" AS source, l."statusId" AS "statusId", COUNT(*)::int AS n
        FROM "Lead" l
        LEFT JOIN "LeadSourceOnLead" x ON x."leadId" = l."id"
        LEFT JOIN "LeadSource" s ON s."id" = x."leadSourceId"
        WHERE l."organizationId" = ${organizationId}
          AND l."deletedAt" IS NULL
          AND (${from}::timestamp IS NULL OR l."createdAt" >= ${from})
          AND (${to}::timestamp IS NULL OR l."createdAt" <= ${to})
        GROUP BY s."id", s."name", l."statusId"`,
      this.getOutcomes(dateFrom, dateTo),
    ]);

    type Acc = { sourceId: string | null; source: string; b: Record<string, number>; lostBy: Map<string, number> };
    const bySource = new Map<string, Acc>();
    for (const r of rows) {
      const key = r.sourceId ?? "none";
      const acc = bySource.get(key) ?? { sourceId: r.sourceId, source: r.source ?? "No source recorded", b: {}, lostBy: new Map() };
      const bucket = bucketOf(r.statusId);
      acc.b[bucket] = (acc.b[bucket] ?? 0) + r.n;
      if (bucket === "lost") {
        const name = (r.statusId && statusById.get(r.statusId)?.name) || "Lost";
        acc.lostBy.set(name, (acc.lostBy.get(name) ?? 0) + r.n);
      }
      bySource.set(key, acc);
    }

    const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);
    const rate = (key: string) => overall.rates.find((r) => r.key === key)?.value ?? null;
    const baseline = { contactRate: rate("contact"), interestRate: rate("interest"), lostRate: rate("lost"), winRate: rate("win") };

    const sources = [...bySource.values()].map((a): LeadSourcePerformanceRow => {
      const leads = Object.values(a.b).reduce((x, y) => x + y, 0);
      const worked = leads - (a.b["New"] ?? 0) - (a.b["other"] ?? 0);
      const interested = (a.b["Interested"] ?? 0) + (a.b["Qualified"] ?? 0) + (a.b["won"] ?? 0);
      const won = a.b["won"] ?? 0;
      const lost = a.b["lost"] ?? 0;
      const row: LeadSourcePerformanceRow = {
        source: a.source,
        sourceId: a.sourceId,
        leads,
        worked,
        interested,
        won,
        lost,
        contactRate: pct(worked, leads),
        interestRate: pct(interested, worked),
        lostRate: pct(lost, leads),
        winRate: pct(won, won + lost),
        topLostReason: [...a.lostBy].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
        rating: "average",
      };
      row.rating = rateSource(row, baseline);
      return row;
    });
    sources.sort((x, y) => y.leads - x.leads);
    return { baseline, minLeads: MIN_SOURCE_LEADS, sources };
  }

  async getSourceBreakdown(dateFrom?: string, dateTo?: string): Promise<SourceBreakdownEntry[]> {
    const leadDateFilter = dateRangeWhere("createdAt", dateFrom, dateTo);
    const rows = await this.prisma.leadSourceOnLead.groupBy({
      by: ["leadSourceId"],
      where: Object.keys(leadDateFilter).length ? { lead: { is: leadDateFilter } } : undefined,
      _count: { _all: true },
    });
    const sources = await this.prisma.leadSource.findMany({
      where: { id: { in: rows.map((r) => r.leadSourceId) } },
    });
    const sourceById = new Map(sources.map((s) => [s.id, s]));

    return rows
      .map((r) => ({ source: { id: r.leadSourceId, name: sourceById.get(r.leadSourceId)?.name ?? "Unknown" }, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  async getStatusOptions(): Promise<LeadStatusOption[]> {
    const statuses = await this.prisma.leadStatus.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    return statuses.map((s) => this.toStatusOption(s));
  }

  async addActivity(leadId: string, dto: CreateLeadActivityDto): Promise<LeadDetail> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException("Lead not found");

    const now = new Date();
    await this.prisma.leadActivity.create({
      data: { organizationId: TenantContext.get().organizationId, leadId, type: dto.type, note: dto.note },
    });

    const statusUpdate: Prisma.LeadUpdateInput = { lastActivityAt: now };
    if (dto.newStatusId) {
      const newStatus = await this.prisma.leadStatus.findUnique({ where: { id: dto.newStatusId } });
      if (!newStatus) throw new NotFoundException("Lead status not found");
      statusUpdate.status = { connect: { id: dto.newStatusId } };
      if (newStatus.stage === "WON") statusUpdate.wonAt = now;
      if (newStatus.stage === "LOST") statusUpdate.lostAt = now;
    }
    await this.prisma.lead.update({ where: { id: leadId }, data: statusUpdate });
    await this.scoring.recomputeOne(leadId);

    return this.findOne(leadId);
  }

  scanBusinessCard(dto: ScanBusinessCardDto): Promise<BusinessCardDraft> {
    return this.cardParser.parse(dto.imageDataUrl);
  }

  async getLeadTypeOptions(): Promise<LeadTypeOption[]> {
    const types = await this.prisma.leadType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    return types.map((t) => ({ id: t.id, name: t.name }));
  }

  async getExecutiveOptions(): Promise<ExecutiveOption[]> {
    const execs = await this.prisma.salesExecutive.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
    return execs.map((e) => ({ id: e.id, name: e.name }));
  }

  async checkDuplicates(phone: string, email: string | null): Promise<DuplicateLeadMatch[]> {
    const rows = await this.prisma.lead.findMany({
      where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
      select: { id: true, name: true, leadCode: true, phone: true, email: true },
      take: 5,
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      leadCode: r.leadCode,
      matchedOn: r.phone === phone ? ("phone" as const) : ("email" as const),
    }));
  }

  async getBusinessCardImagePath(id: string): Promise<string> {
    const lead = await this.prisma.lead.findUnique({ where: { id }, select: { businessCardImagePath: true } });
    if (!lead?.businessCardImagePath) throw new NotFoundException("This lead has no saved business card image");
    return lead.businessCardImagePath;
  }

  async createFromBusinessCard(dto: CreateLeadFromCardDto): Promise<LeadDetail> {
    const leadCode = await this.coding.next();
    const organizationId = TenantContext.get().organizationId;
    const source = await this.prisma.leadSource.upsert({
      where: { organizationId_name: { organizationId, name: BUSINESS_CARD_SOURCE_NAME } },
      update: {},
      create: { organizationId, name: BUSINESS_CARD_SOURCE_NAME, score: 8 },
    });

    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        leadCode,
        name: dto.name,
        company: dto.company ?? null,
        phone: dto.phone,
        email: dto.email ?? null,
        website: dto.website ?? null,
        address: dto.address ?? null,
        state: dto.state,
        city: dto.city,
        leadTypeId: dto.leadTypeId ?? null,
        assignedExecId: dto.assignedExecId ?? null,
        statusId: dto.statusId ?? null,
        notes: dto.notes ?? null,
        lastActivityAt: new Date(),
      },
    });
    await this.prisma.leadSourceOnLead.create({ data: { organizationId, leadId: lead.id, leadSourceId: source.id } });

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

    if (dto.saveImage && dto.imageDataUrl) {
      const path = this.cardImages.save(lead.id, dto.imageDataUrl);
      await this.prisma.lead.update({ where: { id: lead.id }, data: { businessCardImagePath: path } });
    }

    await this.scoring.recomputeOne(lead.id);
    return this.findOne(lead.id);
  }

  private mapSort(sortBy: string | undefined, sortDir: "asc" | "desc"): Prisma.LeadOrderByWithRelationInput {
    switch (sortBy) {
      case "company":
        return { company: sortDir };
      case "nextFollowUpAt":
        return { nextFollowUpAt: sortDir };
      case "score":
        return { score: sortDir };
      case "estimatedValue":
        return { estimatedValue: sortDir };
      case "name":
        return { name: sortDir };
      case "createdAt":
      default:
        return { createdAt: sortDir };
    }
  }

  private toStatusOption(status: { id: string; name: string; stage: string; sortOrder: number }): LeadStatusOption {
    return { id: status.id, name: status.name, stage: status.stage as LeadStatusOption["stage"], sortOrder: status.sortOrder };
  }

  private toListItem(lead: LeadWithRelations): LeadListItem {
    const now = new Date();
    const isTerminal = lead.status?.stage === "WON" || lead.status?.stage === "LOST";
    return {
      id: lead.id,
      leadCode: lead.leadCode,
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      email: lead.email,
      sources: lead.sources.map((s) => ({ id: s.leadSource.id, name: s.leadSource.name })),
      state: lead.state,
      city: lead.city,
      leadType: lead.leadType ? { id: lead.leadType.id, name: lead.leadType.name } : null,
      assignedExecName: lead.assignedExec?.name ?? null,
      status: lead.status ? this.toStatusOption(lead.status) : null,
      score: lead.score,
      estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
      lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
      isOverdue: !!lead.nextFollowUpAt && lead.nextFollowUpAt < now && !isTerminal,
    };
  }
}

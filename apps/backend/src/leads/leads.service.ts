import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, PermissionModule, Priority, Prisma, RoleName } from "@prisma/client";
import {
  BusinessCardDraft,
  DuplicateLeadMatch,
  ExecutiveOption,
  FunnelStage,
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
import { dateRangeWhere } from "../common/utils/date-range.util";
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
    const { page, pageSize, sortBy, sortDir, q, statusId, dateFrom, dateTo } = query;

    const where: Prisma.LeadWhereInput = {
      ...(statusId ? { statusId } : {}),
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
    const statuses = await this.prisma.leadStatus.findMany({
      where: { stage: { in: ["OPEN", "WON"] } },
      orderBy: { sortOrder: "asc" },
    });

    const counts = await this.prisma.lead.groupBy({
      by: ["statusId"],
      where: { statusId: { in: statuses.map((s) => s.id) }, ...dateRangeWhere("createdAt", dateFrom, dateTo) },
      _count: { _all: true },
    });
    const countByStatusId = new Map(counts.map((c) => [c.statusId, c._count._all]));

    // Cumulative funnel: each stage counts leads at or beyond it in sortOrder.
    return statuses.map((stage, idx) => ({
      stage: this.toStatusOption(stage),
      label: stage.name,
      count: statuses.slice(idx).reduce((sum, s) => sum + (countByStatusId.get(s.id) ?? 0), 0),
    }));
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

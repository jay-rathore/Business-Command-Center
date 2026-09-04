import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityType, Builder, OrderStatus, Prisma } from "@prisma/client";
import {
  PaginatedResponse,
  ReferralPartnerKpis,
  ReferralPartnerLeaderboardEntry,
  ReferralPartnerListItem,
  RecentReferralItem,
} from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { startOfMonth } from "../common/utils/date";
import { dateRangeWhere } from "../common/utils/date-range.util";
import { BuildersListQueryDto, isBuilderComputedSortKey } from "./dto/builders-list-query.dto";

const NOT_CANCELLED: Prisma.OrderWhereInput = { status: { not: OrderStatus.CANCELLED } };

interface PartnerStats {
  projectsReferred: number;
  leadsReferred: number;
  sampleRequestsSent: number;
  projectValue: number;
  revenueInfluenced: number;
}

const EMPTY_STATS: PartnerStats = {
  projectsReferred: 0,
  leadsReferred: 0,
  sampleRequestsSent: 0,
  projectValue: 0,
  revenueInfluenced: 0,
};

@Injectable()
export class BuildersService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async findAll(query: BuildersListQueryDto): Promise<PaginatedResponse<ReferralPartnerListItem>> {
    const { page, pageSize, sortBy, sortDir, q, dateFrom, dateTo } = query;

    const builders = await this.prisma.builder.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { company: { contains: q, mode: "insensitive" as const } },
              { city: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : undefined,
    });

    const stats = await this.getPartnerStats(builders.map((b) => b.id), dateFrom, dateTo);
    const items = builders.map((b) => this.toListItem(b, stats.get(b.id)));

    items.sort((a, b) => {
      if (isBuilderComputedSortKey(sortBy)) {
        const av = (a[sortBy] ?? -Infinity) as number;
        const bv = (b[sortBy] ?? -Infinity) as number;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const key = (sortBy ?? "name") as "name" | "company" | "city" | "state" | "joinedAt";
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    return buildPaginatedResponse(paged, total, page, pageSize);
  }

  async findOne(id: string): Promise<ReferralPartnerListItem> {
    const builder = await this.prisma.builder.findUnique({ where: { id } });
    if (!builder) throw new NotFoundException("Builder not found");
    const stats = await this.getPartnerStats([id]);
    return this.toListItem(builder, stats.get(id));
  }

  async getKpis(dateFrom?: string, dateTo?: string): Promise<ReferralPartnerKpis> {
    const builders = await this.prisma.builder.findMany();
    const stats = await this.getPartnerStats(builders.map((b) => b.id), dateFrom, dateTo);
    const monthStart = startOfMonth(new Date());

    const totals = Array.from(stats.values()).reduce(
      (acc, s) => ({
        projectsReferred: acc.projectsReferred + s.projectsReferred,
        leadsReferred: acc.leadsReferred + s.leadsReferred,
        sampleRequestsSent: acc.sampleRequestsSent + s.sampleRequestsSent,
        projectValue: acc.projectValue + s.projectValue,
        revenueInfluenced: acc.revenueInfluenced + s.revenueInfluenced,
      }),
      { ...EMPTY_STATS },
    );

    return {
      total: builders.length,
      newThisMonth: builders.filter((b) => b.joinedAt && b.joinedAt >= monthStart).length,
      ...totals,
    };
  }

  async getLeaderboard(dateFrom?: string, dateTo?: string): Promise<ReferralPartnerLeaderboardEntry[]> {
    const builders = await this.prisma.builder.findMany();
    const stats = await this.getPartnerStats(builders.map((b) => b.id), dateFrom, dateTo);

    return builders
      .map((b) => {
        const s = stats.get(b.id) ?? EMPTY_STATS;
        return { id: b.id, name: b.name, projects: s.projectsReferred, projectValue: s.projectValue, revenueInfluenced: s.revenueInfluenced };
      })
      .sort((a, b) => b.projectValue - a.projectValue)
      .slice(0, 5);
  }

  async getRecentReferrals(): Promise<RecentReferralItem[]> {
    const projects = await this.prisma.project.findMany({
      where: { builderId: { not: null } },
      include: { builder: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return projects.map((p) => ({
      id: p.id,
      projectName: p.name,
      partnerName: p.builder?.name ?? "Unknown",
      stage: p.stage,
      estimatedValue: Number(p.estimatedValue),
      createdAt: p.createdAt.toISOString(),
    }));
  }

  private async getPartnerStats(builderIds: string[], dateFrom?: string, dateTo?: string): Promise<Map<string, PartnerStats>> {
    const result = new Map<string, PartnerStats>();
    if (builderIds.length === 0) return result;
    for (const id of builderIds) result.set(id, { ...EMPTY_STATS });

    const projectDateFilter = dateRangeWhere("createdAt", dateFrom, dateTo);
    const leadDateFilter = dateRangeWhere("createdAt", dateFrom, dateTo);
    const orderDateFilter = dateRangeWhere("orderDate", dateFrom, dateTo);
    const activityDateFilter = dateRangeWhere("occurredAt", dateFrom, dateTo);

    const [projects, leadCounts, builderLeads] = await Promise.all([
      this.prisma.project.findMany({
        where: { builderId: { in: builderIds }, ...projectDateFilter },
        select: { id: true, builderId: true, estimatedValue: true },
      }),
      this.prisma.lead.groupBy({
        by: ["referredByBuilderId"],
        where: { referredByBuilderId: { in: builderIds }, ...leadDateFilter },
        _count: { _all: true },
      }),
      this.prisma.lead.findMany({
        where: { referredByBuilderId: { in: builderIds } },
        select: { id: true, referredByBuilderId: true },
      }),
    ]);

    const projectIds = projects.map((p) => p.id);
    const leadIds = builderLeads.map((l) => l.id);

    const [orderAgg, projectSampleAgg, leadSampleAgg] = await Promise.all([
      projectIds.length
        ? this.prisma.order.groupBy({
            by: ["projectId"],
            where: { projectId: { in: projectIds }, ...NOT_CANCELLED, ...orderDateFilter },
            _sum: { totalAmount: true },
          })
        : Promise.resolve([]),
      projectIds.length
        ? this.prisma.projectActivity.groupBy({
            by: ["projectId"],
            where: { projectId: { in: projectIds }, type: ActivityType.SAMPLE_SENT, ...activityDateFilter },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      leadIds.length
        ? this.prisma.leadActivity.groupBy({
            by: ["leadId"],
            where: { leadId: { in: leadIds }, type: ActivityType.SAMPLE_SENT, ...activityDateFilter },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const builderByProject = new Map(projects.map((p) => [p.id, p.builderId as string]));
    const builderByLead = new Map(builderLeads.map((l) => [l.id, l.referredByBuilderId as string]));
    const leadsByBuilder = new Map(leadCounts.map((r) => [r.referredByBuilderId, r._count._all]));

    for (const [builderId, count] of leadsByBuilder) {
      const s = builderId ? result.get(builderId) : undefined;
      if (s) s.leadsReferred = count;
    }
    for (const p of projects) {
      const s = result.get(p.builderId as string);
      if (s) {
        s.projectsReferred += 1;
        s.projectValue += Number(p.estimatedValue);
      }
    }
    for (const row of orderAgg) {
      const builderId = builderByProject.get(row.projectId as string);
      const s = builderId ? result.get(builderId) : undefined;
      if (s) s.revenueInfluenced += Number(row._sum.totalAmount ?? 0);
    }
    for (const row of projectSampleAgg) {
      const builderId = builderByProject.get(row.projectId as string);
      const s = builderId ? result.get(builderId) : undefined;
      if (s) s.sampleRequestsSent += row._count._all;
    }
    for (const row of leadSampleAgg) {
      const builderId = builderByLead.get(row.leadId);
      const s = builderId ? result.get(builderId) : undefined;
      if (s) s.sampleRequestsSent += row._count._all;
    }

    return result;
  }

  private toListItem(builder: Builder, stats?: PartnerStats): ReferralPartnerListItem {
    const s = stats ?? EMPTY_STATS;
    return {
      id: builder.id,
      name: builder.name,
      company: builder.company,
      city: builder.city,
      state: builder.state,
      phone: builder.phone,
      email: builder.email,
      joinedAt: builder.joinedAt?.toISOString() ?? null,
      lastActivityAt: builder.lastActivityAt?.toISOString() ?? null,
      ...s,
    };
  }
}

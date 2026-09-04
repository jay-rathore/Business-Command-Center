import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityType, Architect, OrderStatus, Prisma } from "@prisma/client";
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
import { ArchitectsListQueryDto, isArchitectComputedSortKey } from "./dto/architects-list-query.dto";

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
export class ArchitectsService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async findAll(query: ArchitectsListQueryDto): Promise<PaginatedResponse<ReferralPartnerListItem>> {
    const { page, pageSize, sortBy, sortDir, q, dateFrom, dateTo } = query;

    const architects = await this.prisma.architect.findMany({
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

    const stats = await this.getPartnerStats(architects.map((a) => a.id), dateFrom, dateTo);
    const items = architects.map((a) => this.toListItem(a, stats.get(a.id)));

    items.sort((a, b) => {
      if (isArchitectComputedSortKey(sortBy)) {
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
    const architect = await this.prisma.architect.findUnique({ where: { id } });
    if (!architect) throw new NotFoundException("Architect not found");
    const stats = await this.getPartnerStats([id]);
    return this.toListItem(architect, stats.get(id));
  }

  async getKpis(dateFrom?: string, dateTo?: string): Promise<ReferralPartnerKpis> {
    const architects = await this.prisma.architect.findMany();
    const stats = await this.getPartnerStats(architects.map((a) => a.id), dateFrom, dateTo);
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
      total: architects.length,
      newThisMonth: architects.filter((a) => a.joinedAt && a.joinedAt >= monthStart).length,
      ...totals,
    };
  }

  async getLeaderboard(dateFrom?: string, dateTo?: string): Promise<ReferralPartnerLeaderboardEntry[]> {
    const architects = await this.prisma.architect.findMany();
    const stats = await this.getPartnerStats(architects.map((a) => a.id), dateFrom, dateTo);

    return architects
      .map((a) => {
        const s = stats.get(a.id) ?? EMPTY_STATS;
        return { id: a.id, name: a.name, projects: s.projectsReferred, projectValue: s.projectValue, revenueInfluenced: s.revenueInfluenced };
      })
      .sort((a, b) => b.projectValue - a.projectValue)
      .slice(0, 5);
  }

  async getRecentReferrals(): Promise<RecentReferralItem[]> {
    const projects = await this.prisma.project.findMany({
      where: { architectId: { not: null } },
      include: { architect: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return projects.map((p) => ({
      id: p.id,
      projectName: p.name,
      partnerName: p.architect?.name ?? "Unknown",
      stage: p.stage,
      estimatedValue: Number(p.estimatedValue),
      createdAt: p.createdAt.toISOString(),
    }));
  }

  private async getPartnerStats(architectIds: string[], dateFrom?: string, dateTo?: string): Promise<Map<string, PartnerStats>> {
    const result = new Map<string, PartnerStats>();
    if (architectIds.length === 0) return result;
    for (const id of architectIds) result.set(id, { ...EMPTY_STATS });

    const projectDateFilter = dateRangeWhere("createdAt", dateFrom, dateTo);
    const leadDateFilter = dateRangeWhere("createdAt", dateFrom, dateTo);
    const orderDateFilter = dateRangeWhere("orderDate", dateFrom, dateTo);
    const activityDateFilter = dateRangeWhere("occurredAt", dateFrom, dateTo);

    const [projects, leadCounts, architectLeads] = await Promise.all([
      this.prisma.project.findMany({
        where: { architectId: { in: architectIds }, ...projectDateFilter },
        select: { id: true, architectId: true, estimatedValue: true },
      }),
      this.prisma.lead.groupBy({
        by: ["referredByArchitectId"],
        where: { referredByArchitectId: { in: architectIds }, ...leadDateFilter },
        _count: { _all: true },
      }),
      this.prisma.lead.findMany({
        where: { referredByArchitectId: { in: architectIds } },
        select: { id: true, referredByArchitectId: true },
      }),
    ]);

    const projectIds = projects.map((p) => p.id);
    const leadIds = architectLeads.map((l) => l.id);

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

    const architectByProject = new Map(projects.map((p) => [p.id, p.architectId as string]));
    const architectByLead = new Map(architectLeads.map((l) => [l.id, l.referredByArchitectId as string]));
    const leadsByArchitect = new Map(leadCounts.map((r) => [r.referredByArchitectId, r._count._all]));

    for (const [architectId, count] of leadsByArchitect) {
      const s = architectId ? result.get(architectId) : undefined;
      if (s) s.leadsReferred = count;
    }
    for (const p of projects) {
      const s = result.get(p.architectId as string);
      if (s) {
        s.projectsReferred += 1;
        s.projectValue += Number(p.estimatedValue);
      }
    }
    for (const row of orderAgg) {
      const architectId = architectByProject.get(row.projectId as string);
      const s = architectId ? result.get(architectId) : undefined;
      if (s) s.revenueInfluenced += Number(row._sum.totalAmount ?? 0);
    }
    for (const row of projectSampleAgg) {
      const architectId = architectByProject.get(row.projectId as string);
      const s = architectId ? result.get(architectId) : undefined;
      if (s) s.sampleRequestsSent += row._count._all;
    }
    for (const row of leadSampleAgg) {
      const architectId = architectByLead.get(row.leadId);
      const s = architectId ? result.get(architectId) : undefined;
      if (s) s.sampleRequestsSent += row._count._all;
    }

    return result;
  }

  private toListItem(architect: Architect, stats?: PartnerStats): ReferralPartnerListItem {
    const s = stats ?? EMPTY_STATS;
    return {
      id: architect.id,
      name: architect.name,
      company: architect.company,
      city: architect.city,
      state: architect.state,
      phone: architect.phone,
      email: architect.email,
      joinedAt: architect.joinedAt?.toISOString() ?? null,
      lastActivityAt: architect.lastActivityAt?.toISOString() ?? null,
      ...s,
    };
  }
}

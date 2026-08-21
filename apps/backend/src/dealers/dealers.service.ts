import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DealerStatus, OrderStatus, Prisma } from "@prisma/client";
import {
  DealerDetail,
  DealerLeaderboardEntry,
  DealerListItem,
  DealersKpis,
  PaginatedResponse,
} from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { daysAgo } from "../common/utils/date";
import { DealersListQueryDto, isDealerComputedSortKey } from "./dto/dealers-list-query.dto";
import { DealerScoringService } from "./dealer-scoring.service";

const NOT_CANCELLED: Prisma.OrderWhereInput = { status: { not: OrderStatus.CANCELLED } };

type DealerWithManager = Prisma.DealerGetPayload<{ include: { assignedManager: true } }>;

interface DealerOrderStats {
  totalOrders: number;
  revenue: number;
  growth: number | null;
  lastOrderAt: Date | null;
}

@Injectable()
export class DealersService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly scoring: DealerScoringService,
  ) {}

  async findAll(query: DealersListQueryDto): Promise<PaginatedResponse<DealerListItem>> {
    const { page, pageSize, sortBy, sortDir, q, status, state } = query;

    const where: Prisma.DealerWhereInput = {
      ...(status ? { status } : {}),
      ...(state ? { state } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { dealerCode: { contains: q, mode: "insensitive" as const } },
              { city: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    if (isDealerComputedSortKey(sortBy)) {
      const all = await this.prisma.dealer.findMany({ where, include: { assignedManager: true } });
      const stats = await this.getOrderStats(all.map((d) => d.id));
      const items = all.map((d) => this.toListItem(d, stats.get(d.id)));
      items.sort((a, b) => {
        const av = (a[sortBy] ?? -Infinity) as number;
        const bv = (b[sortBy] ?? -Infinity) as number;
        return sortDir === "asc" ? av - bv : bv - av;
      });
      const total = items.length;
      const paged = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
      return buildPaginatedResponse(paged, total, page, pageSize);
    }

    const [dealers, total] = await Promise.all([
      this.prisma.dealer.findMany({
        where,
        include: { assignedManager: true },
        orderBy: this.mapColumnSort(sortBy, sortDir),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dealer.count({ where }),
    ]);

    const stats = await this.getOrderStats(dealers.map((d) => d.id));
    const data = dealers.map((d) => this.toListItem(d, stats.get(d.id)));
    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(id: string): Promise<DealerDetail> {
    const dealer = await this.prisma.dealer.findUnique({ where: { id }, include: { assignedManager: true } });
    if (!dealer) throw new NotFoundException("Dealer not found");

    const stats = await this.getOrderStats([id]);
    const listItem = this.toListItem(dealer, stats.get(id));

    return {
      ...listItem,
      phone: dealer.phone,
      email: dealer.email,
      address: dealer.address,
      healthScoreBreakdown: (dealer.healthScoreBreakdown as DealerDetail["healthScoreBreakdown"]) ?? null,
      healthScoreUpdatedAt: dealer.healthScoreUpdatedAt?.toISOString() ?? null,
    };
  }

  async getKpis(): Promise<DealersKpis> {
    const [statusCounts, allDealers] = await Promise.all([
      this.prisma.dealer.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.dealer.findMany({ select: { id: true, healthScore: true } }),
    ]);

    const countByStatus = new Map(statusCounts.map((r) => [r.status, r._count._all]));
    const stats = await this.getOrderStats(allDealers.map((d) => d.id));

    let networkRevenue = 0;
    let currentTotal = 0;
    let previousTotal = 0;
    const now = new Date();
    const currentStart = daysAgo(30, now);
    const previousStart = daysAgo(60, now);

    const [currentAgg, previousAgg] = await Promise.all([
      this.prisma.order.aggregate({
        where: { ...NOT_CANCELLED, dealerId: { not: null }, orderDate: { gte: currentStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: { ...NOT_CANCELLED, dealerId: { not: null }, orderDate: { gte: previousStart, lt: currentStart } },
        _sum: { totalAmount: true },
      }),
    ]);
    currentTotal = Number(currentAgg._sum.totalAmount ?? 0);
    previousTotal = Number(previousAgg._sum.totalAmount ?? 0);

    for (const s of stats.values()) networkRevenue += s.revenue;

    const healthScores = allDealers.map((d) => d.healthScore).filter((s): s is number => s !== null);

    return {
      totalDealers: allDealers.length,
      activeDealers: countByStatus.get(DealerStatus.ACTIVE) ?? 0,
      newDealers: countByStatus.get(DealerStatus.NEW) ?? 0,
      atRiskDealers: countByStatus.get(DealerStatus.AT_RISK) ?? 0,
      inactiveDealers: countByStatus.get(DealerStatus.INACTIVE) ?? 0,
      networkRevenue,
      avgHealthScore: healthScores.length > 0 ? Math.round(healthScores.reduce((s, v) => s + v, 0) / healthScores.length) : null,
      orderGrowth: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null,
    };
  }

  async getLeaderboard(): Promise<DealerLeaderboardEntry[]> {
    const dealers = await this.prisma.dealer.findMany({
      orderBy: { healthScore: "desc" },
      take: 5,
    });
    const stats = await this.getOrderStats(dealers.map((d) => d.id));
    return dealers.map((d) => ({
      id: d.id,
      name: d.name,
      healthScore: d.healthScore,
      totalOrders: stats.get(d.id)?.totalOrders ?? 0,
      revenue: stats.get(d.id)?.revenue ?? 0,
    }));
  }

  async getRiskAlerts(): Promise<DealerListItem[]> {
    const dealers = await this.prisma.dealer.findMany({
      where: { status: { in: [DealerStatus.AT_RISK, DealerStatus.INACTIVE] } },
      include: { assignedManager: true },
      orderBy: { healthScore: "asc" },
      take: 8,
    });
    const stats = await this.getOrderStats(dealers.map((d) => d.id));
    return dealers.map((d) => this.toListItem(d, stats.get(d.id)));
  }

  async recomputeScore(id: string): Promise<DealerDetail> {
    await this.scoring.recomputeOne(id);
    return this.findOne(id);
  }

  private mapColumnSort(sortBy: string | undefined, sortDir: "asc" | "desc"): Prisma.DealerOrderByWithRelationInput {
    switch (sortBy) {
      case "dealerCode":
        return { dealerCode: sortDir };
      case "state":
        return { state: sortDir };
      case "joinedAt":
        return { joinedAt: sortDir };
      case "name":
      default:
        return { name: sortDir };
    }
  }

  private toListItem(dealer: DealerWithManager, stats?: DealerOrderStats): DealerListItem {
    const s = stats ?? { totalOrders: 0, revenue: 0, growth: null, lastOrderAt: null };
    return {
      id: dealer.id,
      dealerCode: dealer.dealerCode,
      name: dealer.name,
      contactName: dealer.contactName,
      city: dealer.city,
      state: dealer.state,
      status: dealer.status,
      managerName: dealer.assignedManager?.name ?? null,
      joinedAt: dealer.joinedAt.toISOString(),
      lastOrderAt: s.lastOrderAt?.toISOString() ?? null,
      totalOrders: s.totalOrders,
      revenue: s.revenue,
      growth: s.growth,
      healthScore: dealer.healthScore,
    };
  }

  private async getOrderStats(dealerIds: string[]): Promise<Map<string, DealerOrderStats>> {
    const result = new Map<string, DealerOrderStats>();
    if (dealerIds.length === 0) return result;

    const now = new Date();
    const currentStart = daysAgo(30, now);
    const previousStart = daysAgo(60, now);

    const [lifetime, lastOrder, currentRevenue, previousRevenue] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["dealerId"],
        where: { dealerId: { in: dealerIds }, ...NOT_CANCELLED },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ["dealerId"],
        where: { dealerId: { in: dealerIds }, ...NOT_CANCELLED },
        _max: { orderDate: true },
      }),
      this.prisma.order.groupBy({
        by: ["dealerId"],
        where: { dealerId: { in: dealerIds }, ...NOT_CANCELLED, orderDate: { gte: currentStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ["dealerId"],
        where: { dealerId: { in: dealerIds }, ...NOT_CANCELLED, orderDate: { gte: previousStart, lt: currentStart } },
        _sum: { totalAmount: true },
      }),
    ]);

    const lifetimeMap = new Map(lifetime.map((r) => [r.dealerId, r]));
    const lastOrderMap = new Map(lastOrder.map((r) => [r.dealerId, r._max.orderDate]));
    const currentRevMap = new Map(currentRevenue.map((r) => [r.dealerId, Number(r._sum.totalAmount ?? 0)]));
    const previousRevMap = new Map(previousRevenue.map((r) => [r.dealerId, Number(r._sum.totalAmount ?? 0)]));

    for (const id of dealerIds) {
      const lt = lifetimeMap.get(id);
      const current = currentRevMap.get(id) ?? 0;
      const previous = previousRevMap.get(id) ?? 0;
      result.set(id, {
        totalOrders: lt?._count._all ?? 0,
        revenue: Number(lt?._sum.totalAmount ?? 0),
        growth: previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : null,
        lastOrderAt: lastOrderMap.get(id) ?? null,
      });
    }
    return result;
  }
}

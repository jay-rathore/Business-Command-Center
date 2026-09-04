import { Inject, Injectable } from "@nestjs/common";
import { EmployeeStatus, OrderStatus, Prisma } from "@prisma/client";
import {
  FollowUpRiskLead,
  PaginatedResponse,
  SalesTeamExecutive,
  SalesTeamKpis,
  SalesTeamLeaderboardEntry,
} from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { startOfMonth } from "../common/utils/date";
import { dateRangeWhere } from "../common/utils/date-range.util";
import { isSalesTeamComputedSortKey, SalesTeamListQueryDto } from "./dto/sales-team-list-query.dto";

const NOT_CANCELLED: Prisma.OrderWhereInput = { status: { not: OrderStatus.CANCELLED } };
const OPEN_FOLLOW_UP: Prisma.LeadWhereInput = { OR: [{ statusId: null }, { status: { stage: { notIn: ["WON", "LOST"] } } }] };

type ExecWithManager = Prisma.SalesExecutiveGetPayload<{ include: { manager: true } }>;

interface ExecStats {
  revenue: number;
  orders: number;
  leadsAssigned: number;
  leadsWon: number;
  overdueFollowUps: number;
  targetRevenue: number | null;
}

@Injectable()
export class SalesTeamService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async findAll(query: SalesTeamListQueryDto): Promise<PaginatedResponse<SalesTeamExecutive>> {
    const { page, pageSize, sortBy, sortDir, q, dateFrom, dateTo } = query;

    const execs = await this.prisma.salesExecutive.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { employeeCode: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: { manager: true },
    });

    const stats = await this.getExecStats(execs.map((e) => e.id), dateFrom, dateTo);
    let items = execs.map((e) => this.toExecutive(e, stats.get(e.id)));

    items.sort((a, b) => {
      if (isSalesTeamComputedSortKey(sortBy)) {
        const av = (a[sortBy] ?? -Infinity) as number;
        const bv = (b[sortBy] ?? -Infinity) as number;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const key = (sortBy ?? "name") as "name" | "designation" | "state";
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    return buildPaginatedResponse(paged, total, page, pageSize);
  }

  async getKpis(dateFrom?: string, dateTo?: string): Promise<SalesTeamKpis> {
    const now = new Date();
    const [activeExecutives, revenueAgg, execTargets, overdueFollowUps] = await Promise.all([
      this.prisma.salesExecutive.count({ where: { status: EmployeeStatus.ACTIVE } }),
      this.prisma.order.aggregate({
        where: { ...NOT_CANCELLED, salesExecId: { not: null }, ...this.orderDateWhere(dateFrom, dateTo, now) },
        _sum: { totalAmount: true },
      }),
      this.prisma.salesTarget.findMany({
        where: { scope: "SALES_EXECUTIVE", periodStart: { lte: now }, periodEnd: { gte: now } },
        select: { targetRevenue: true },
      }),
      this.prisma.lead.count({ where: { nextFollowUpAt: { lt: now }, ...OPEN_FOLLOW_UP } }),
    ]);

    const teamRevenue = Number(revenueAgg._sum.totalAmount ?? 0);
    const teamTargetRevenue = execTargets.length
      ? execTargets.reduce((sum, t) => sum + Number(t.targetRevenue), 0)
      : null;

    return {
      activeExecutives,
      teamRevenue,
      teamTargetRevenue,
      teamAchievement: teamTargetRevenue && teamTargetRevenue > 0 ? (teamRevenue / teamTargetRevenue) * 100 : null,
      overdueFollowUps,
    };
  }

  async getLeaderboard(dateFrom?: string, dateTo?: string): Promise<SalesTeamLeaderboardEntry[]> {
    const execs = await this.prisma.salesExecutive.findMany({ where: { status: EmployeeStatus.ACTIVE } });
    const stats = await this.getExecStats(execs.map((e) => e.id), dateFrom, dateTo);

    return execs
      .map((e) => {
        const s = stats.get(e.id);
        return {
          id: e.id,
          name: e.name,
          designation: e.designation,
          revenue: s?.revenue ?? 0,
          orders: s?.orders ?? 0,
          achievementPct: s?.targetRevenue ? ((s.revenue) / s.targetRevenue) * 100 : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  async getFollowUpRisk(): Promise<FollowUpRiskLead[]> {
    const now = new Date();
    const leads = await this.prisma.lead.findMany({
      where: { nextFollowUpAt: { lt: now }, ...OPEN_FOLLOW_UP },
      include: { assignedExec: true, status: true },
      orderBy: { nextFollowUpAt: "asc" },
      take: 8,
    });

    return leads.map((l) => ({
      id: l.id,
      leadCode: l.leadCode,
      name: l.name,
      company: l.company,
      execId: l.assignedExecId,
      execName: l.assignedExec?.name ?? null,
      statusName: l.status?.name ?? null,
      estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
      nextFollowUpAt: l.nextFollowUpAt!.toISOString(),
      daysOverdue: Math.floor((now.getTime() - l.nextFollowUpAt!.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  }

  private orderDateWhere(dateFrom: string | undefined, dateTo: string | undefined, now: Date): Prisma.OrderWhereInput {
    if (dateFrom || dateTo) return dateRangeWhere("orderDate", dateFrom, dateTo);
    return { orderDate: { gte: startOfMonth(now) } };
  }

  private async getExecStats(execIds: string[], dateFrom?: string, dateTo?: string): Promise<Map<string, ExecStats>> {
    const result = new Map<string, ExecStats>();
    if (execIds.length === 0) return result;

    const now = new Date();
    const orderDateFilter = this.orderDateWhere(dateFrom, dateTo, now);
    const leadDateFilter = dateRangeWhere("createdAt", dateFrom, dateTo);

    const [revenueRows, leadCounts, wonCounts, overdueCounts, targets] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["salesExecId"],
        where: { ...NOT_CANCELLED, salesExecId: { in: execIds }, ...orderDateFilter },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ["assignedExecId"],
        where: { assignedExecId: { in: execIds }, ...leadDateFilter },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ["assignedExecId"],
        where: { assignedExecId: { in: execIds }, status: { stage: "WON" }, ...leadDateFilter },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ["assignedExecId"],
        where: { assignedExecId: { in: execIds }, nextFollowUpAt: { lt: now }, ...OPEN_FOLLOW_UP },
        _count: { _all: true },
      }),
      this.prisma.salesTarget.findMany({
        where: { scope: "SALES_EXECUTIVE", salesExecutiveId: { in: execIds }, periodStart: { lte: now }, periodEnd: { gte: now } },
        select: { salesExecutiveId: true, targetRevenue: true },
      }),
    ]);

    const revenueByExec = new Map(revenueRows.map((r) => [r.salesExecId, { revenue: Number(r._sum.totalAmount ?? 0), orders: r._count._all }]));
    const leadsByExec = new Map(leadCounts.map((r) => [r.assignedExecId, r._count._all]));
    const wonByExec = new Map(wonCounts.map((r) => [r.assignedExecId, r._count._all]));
    const overdueByExec = new Map(overdueCounts.map((r) => [r.assignedExecId, r._count._all]));
    const targetByExec = new Map(targets.map((t) => [t.salesExecutiveId, Number(t.targetRevenue)]));

    for (const id of execIds) {
      const rev = revenueByExec.get(id) ?? { revenue: 0, orders: 0 };
      result.set(id, {
        revenue: rev.revenue,
        orders: rev.orders,
        leadsAssigned: leadsByExec.get(id) ?? 0,
        leadsWon: wonByExec.get(id) ?? 0,
        overdueFollowUps: overdueByExec.get(id) ?? 0,
        targetRevenue: targetByExec.get(id) ?? null,
      });
    }
    return result;
  }

  private toExecutive(exec: ExecWithManager, stats?: ExecStats): SalesTeamExecutive {
    const s: ExecStats = stats ?? { revenue: 0, orders: 0, leadsAssigned: 0, leadsWon: 0, overdueFollowUps: 0, targetRevenue: null };
    return {
      id: exec.id,
      employeeCode: exec.employeeCode,
      name: exec.name,
      designation: exec.designation,
      state: exec.state,
      managerName: exec.manager?.name ?? null,
      revenue: s.revenue,
      orders: s.orders,
      leadsAssigned: s.leadsAssigned,
      leadsWon: s.leadsWon,
      conversionRate: s.leadsAssigned > 0 ? (s.leadsWon / s.leadsAssigned) * 100 : null,
      targetRevenue: s.targetRevenue,
      achievementPct: s.targetRevenue && s.targetRevenue > 0 ? (s.revenue / s.targetRevenue) * 100 : null,
      overdueFollowUps: s.overdueFollowUps,
    };
  }
}

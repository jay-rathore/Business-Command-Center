import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { ExecutiveOverview } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";
import { dateRangeWhere, endOfDay, parseDateOnly } from "../common/utils/date-range.util";
import { LeadsService } from "../leads/leads.service";

const NOT_CANCELLED: Prisma.OrderWhereInput = { status: { not: OrderStatus.CANCELLED } };
const OPEN_FOLLOW_UP: Prisma.LeadWhereInput = { OR: [{ statusId: null }, { status: { stage: { notIn: ["WON", "LOST"] } } }] };
const DAY = 24 * 60 * 60 * 1000;
const MONTHS_SHOWN = 12;

/** Everything one sales executive has worked on, for the Sales Team drill-down page. The lead analytics
 * deliberately reuse LeadsService (scoped to the executive) so this page and the Leads page can never
 * disagree on what "worked", "interested" or "lost" mean. */
@Injectable()
export class ExecutiveDetailService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly leads: LeadsService,
  ) {}

  async getOverview(id: string, dateFrom?: string, dateTo?: string): Promise<ExecutiveOverview> {
    const exec = await this.prisma.salesExecutive.findUnique({ where: { id }, include: { manager: true } });
    if (!exec) throw new NotFoundException("Sales executive not found");

    const now = new Date();
    const inRange = (field: string) => dateRangeWhere(field, dateFrom, dateTo);

    const [outcomes, teamOutcomes, sources, monthly, overdue, upcoming, overdueLeads, orderAgg, recentOrders, target, projectRows, quotations, invoices, activityByType, recentActivity] =
      await Promise.all([
        this.leads.getOutcomes(dateFrom, dateTo, id),
        this.leads.getOutcomes(dateFrom, dateTo),
        this.leads.getSourcePerformance(dateFrom, dateTo, id),
        this.monthlyTrend(id, dateFrom, dateTo),
        this.prisma.lead.count({ where: { assignedExecId: id, nextFollowUpAt: { lt: now }, ...OPEN_FOLLOW_UP } }),
        this.prisma.lead.count({ where: { assignedExecId: id, nextFollowUpAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY) }, ...OPEN_FOLLOW_UP } }),
        this.prisma.lead.findMany({
          where: { assignedExecId: id, nextFollowUpAt: { lt: now }, ...OPEN_FOLLOW_UP },
          include: { status: true },
          orderBy: { nextFollowUpAt: "asc" },
          take: 10,
        }),
        this.prisma.order.aggregate({ where: { ...NOT_CANCELLED, salesExecId: id, ...inRange("orderDate") }, _sum: { totalAmount: true }, _count: { _all: true } }),
        this.prisma.order.findMany({ where: { ...NOT_CANCELLED, salesExecId: id, ...inRange("orderDate") }, orderBy: { orderDate: "desc" }, take: 5 }),
        this.prisma.salesTarget.findFirst({ where: { scope: "SALES_EXECUTIVE", salesExecutiveId: id, periodStart: { lte: now }, periodEnd: { gte: now } } }),
        this.prisma.project.groupBy({ by: ["stage"], where: { salesExecId: id }, _count: { _all: true }, _sum: { estimatedValue: true } }),
        this.prisma.quotation.aggregate({ where: { createdById: id, ...inRange("quotationDate") }, _count: { _all: true }, _sum: { totalAmount: true } }),
        this.prisma.invoice.aggregate({ where: { createdById: id, ...inRange("invoiceDate") }, _count: { _all: true }, _sum: { totalAmount: true } }),
        this.prisma.leadActivity.groupBy({ by: ["type"], where: { performedById: id, ...inRange("occurredAt") }, _count: { _all: true } }),
        this.prisma.leadActivity.findMany({
          where: { performedById: id, ...inRange("occurredAt") },
          include: { lead: { select: { name: true } } },
          orderBy: { occurredAt: "desc" },
          take: 10,
        }),
      ]);

    const bucket = (key: string) => outcomes.buckets.find((b) => b.key === key)?.count ?? 0;
    const won = bucket("won");
    const lost = bucket("lost");
    const untouched = bucket("new");
    const total = outcomes.total;
    const revenue = Number(orderAgg._sum.totalAmount ?? 0);
    const orders = orderAgg._count._all;
    const targetRevenue = target ? Number(target.targetRevenue) : null;
    const openStages = new Set(["COMPLETED", "LOST"]);

    return {
      executive: {
        id: exec.id,
        employeeCode: exec.employeeCode,
        name: exec.name,
        designation: exec.designation,
        state: exec.state,
        email: exec.email,
        phone: exec.phone,
        managerName: exec.manager?.name ?? null,
        hireDate: exec.hireDate ? exec.hireDate.toISOString() : null,
        status: exec.status,
      },
      lead: {
        total,
        untouched,
        worked: total - untouched - bucket("other"),
        interested: bucket("interested") + bucket("qualified") + won,
        won,
        lost,
        overdueFollowUps: overdue,
        upcomingFollowUps: upcoming,
      },
      outcomes,
      teamRates: teamOutcomes.rates,
      sources,
      monthly,
      revenue: {
        revenue,
        orders,
        avgOrderValue: orders > 0 ? revenue / orders : null,
        targetRevenue,
        achievementPct: targetRevenue && targetRevenue > 0 ? (revenue / targetRevenue) * 100 : null,
      },
      recentOrders: recentOrders.map((o) => ({ id: o.id, orderCode: o.orderCode, orderDate: o.orderDate.toISOString(), status: o.status, totalAmount: Number(o.totalAmount) })),
      projects: {
        total: projectRows.reduce((s, r) => s + r._count._all, 0),
        pipelineValue: projectRows.filter((r) => !openStages.has(r.stage)).reduce((s, r) => s + Number(r._sum.estimatedValue ?? 0), 0),
        byStage: projectRows.map((r) => ({ stage: r.stage, count: r._count._all, value: Number(r._sum.estimatedValue ?? 0) })),
      },
      documents: {
        quotations: { count: quotations._count._all, value: Number(quotations._sum.totalAmount ?? 0) },
        invoices: { count: invoices._count._all, value: Number(invoices._sum.totalAmount ?? 0) },
      },
      activity: {
        total: activityByType.reduce((s, r) => s + r._count._all, 0),
        byType: activityByType.map((r) => ({ type: r.type, count: r._count._all })).sort((a, b) => b.count - a.count),
        recent: recentActivity.map((a) => ({ id: a.id, type: a.type, note: a.note, occurredAt: a.occurredAt.toISOString(), leadId: a.leadId, leadName: a.lead.name })),
      },
      overdueLeads: overdueLeads.map((l) => ({
        id: l.id,
        leadCode: l.leadCode,
        name: l.name,
        company: l.company,
        statusName: l.status?.name ?? null,
        estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
        nextFollowUpAt: l.nextFollowUpAt!.toISOString(),
        daysOverdue: Math.floor((now.getTime() - l.nextFollowUpAt!.getTime()) / DAY),
      })),
    };
  }

  /** Leads assigned / won / lost per month. Won/lost use the CRM's last-activity time as the event date
   * (that is when the status last changed), so a lead can be "assigned" in one month and "won" in another. */
  private async monthlyTrend(execId: string, dateFrom?: string, dateTo?: string) {
    const from = dateFrom ? parseDateOnly(dateFrom) : null;
    const to = dateTo ? endOfDay(parseDateOnly(dateTo)) : null;
    const organizationId = TenantContext.get().organizationId;

    // Raw SQL bypasses the org-scope/soft-delete extensions, so both are filtered by hand.
    const rows = await this.prisma.$queryRaw<{ month: string; kind: string; n: number }[]>`
      SELECT to_char(date_trunc('month', t.d), 'YYYY-MM') AS month, t.kind, COUNT(*)::int AS n
      FROM (
        SELECT l."createdAt" AS d, 'assigned' AS kind FROM "Lead" l
          WHERE l."organizationId" = ${organizationId} AND l."assignedExecId" = ${execId} AND l."deletedAt" IS NULL
        UNION ALL
        SELECT l."wonAt", 'won' FROM "Lead" l
          WHERE l."organizationId" = ${organizationId} AND l."assignedExecId" = ${execId} AND l."deletedAt" IS NULL AND l."wonAt" IS NOT NULL
        UNION ALL
        SELECT l."lostAt", 'lost' FROM "Lead" l
          WHERE l."organizationId" = ${organizationId} AND l."assignedExecId" = ${execId} AND l."deletedAt" IS NULL AND l."lostAt" IS NOT NULL
      ) t
      WHERE (${from}::timestamp IS NULL OR t.d >= ${from}) AND (${to}::timestamp IS NULL OR t.d <= ${to})
      GROUP BY 1, 2`;

    const byMonth = new Map<string, { month: string; assigned: number; won: number; lost: number }>();
    for (const r of rows) {
      const point = byMonth.get(r.month) ?? { month: r.month, assigned: 0, won: 0, lost: 0 };
      point[r.kind as "assigned" | "won" | "lost"] = r.n;
      byMonth.set(r.month, point);
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-MONTHS_SHOWN);
  }
}

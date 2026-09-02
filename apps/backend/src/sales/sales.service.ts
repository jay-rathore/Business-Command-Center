import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import {
  BreakdownDimension,
  BreakdownEntry,
  PaginatedResponse,
  SalesOverview,
  SalesTableRow,
  SalesTrendPoint,
  TrendGranularity,
} from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { daysAgo, startOfMonth, startOfMonthsAgo } from "../common/utils/date";
import { dateRangeWhere, getPreviousEquivalentPeriod, parseDateOnly, endOfDay } from "../common/utils/date-range.util";
import { SalesTableQueryDto } from "./dto/sales-query.dto";
import { TenantContext } from "../common/context/tenant-context";

const NOT_CANCELLED: Prisma.OrderWhereInput = { status: { not: OrderStatus.CANCELLED } };

@Injectable()
export class SalesService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async getOverview(dateFrom?: string, dateTo?: string): Promise<SalesOverview> {
    const now = new Date();

    let currentWhere: Prisma.OrderWhereInput;
    let previousWhere: Prisma.OrderWhereInput;
    if (dateFrom || dateTo) {
      const current = { from: dateFrom ? parseDateOnly(dateFrom) : new Date(0), to: dateTo ? parseDateOnly(dateTo) : now };
      const previous = getPreviousEquivalentPeriod(current);
      currentWhere = { ...NOT_CANCELLED, orderDate: { gte: current.from, lte: endOfDay(current.to) } };
      previousWhere = { ...NOT_CANCELLED, orderDate: { gte: previous.from, lte: endOfDay(previous.to) } };
    } else {
      const periodStart = startOfMonth(now);
      const previousStart = startOfMonthsAgo(1, now);
      currentWhere = { ...NOT_CANCELLED, orderDate: { gte: periodStart } };
      previousWhere = { ...NOT_CANCELLED, orderDate: { gte: previousStart, lt: periodStart } };
    }

    const [current, previous, target] = await Promise.all([
      this.prisma.order.aggregate({
        where: currentWhere,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: previousWhere,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.salesTarget.findFirst({
        where: { scope: "COMPANY", periodStart: { lte: now }, periodEnd: { gte: now } },
      }),
    ]);

    const revenue = Number(current._sum.totalAmount ?? 0);
    const orders = current._count._all;
    const previousRevenue = Number(previous._sum.totalAmount ?? 0);
    const growth = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null;
    const targetRevenue = target ? Number(target.targetRevenue) : null;

    return {
      revenue,
      orders,
      aov: orders > 0 ? revenue / orders : 0,
      growth,
      targetRevenue,
      achievement: targetRevenue && targetRevenue > 0 ? (revenue / targetRevenue) * 100 : null,
    };
  }

  async getRevenueTrend(granularity: TrendGranularity, dateFrom?: string, dateTo?: string): Promise<SalesTrendPoint[]> {
    const trunc = granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "month";
    const daysBack = granularity === "daily" ? 30 : granularity === "weekly" ? 90 : 365;
    const startDate = dateFrom ? parseDateOnly(dateFrom) : daysAgo(daysBack);
    const endDate = dateTo ? endOfDay(parseDateOnly(dateTo)) : null;
    const organizationId = TenantContext.get().organizationId;

    // Raw SQL bypasses the org-scope Prisma extension (same reason "deletedAt IS NULL" is
    // inlined manually here instead of relying on soft-delete.extension.ts) — organizationId
    // must be filtered explicitly.
    const rows = await this.prisma.$queryRaw<{ bucket: Date; revenue: unknown; orders: bigint }[]>`
      SELECT date_trunc(${trunc}, "orderDate") AS bucket,
             COALESCE(SUM("totalAmount"), 0) AS revenue,
             COUNT(*) AS orders
      FROM "Order"
      WHERE "orderDate" >= ${startDate}
        AND (${endDate}::timestamp IS NULL OR "orderDate" <= ${endDate})
        AND "status" != 'CANCELLED'
        AND "deletedAt" IS NULL
        AND "organizationId" = ${organizationId}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    let targets: { periodStart: Date; periodEnd: Date; targetRevenue: Prisma.Decimal }[] = [];
    if (granularity === "monthly") {
      targets = await this.prisma.salesTarget.findMany({
        where: { scope: "COMPANY", periodStart: { gte: startDate } },
        select: { periodStart: true, periodEnd: true, targetRevenue: true },
      });
    }

    return rows.map((r) => {
      const bucketDate = new Date(r.bucket);
      const matchingTarget = targets.find((t) => bucketDate >= t.periodStart && bucketDate <= t.periodEnd);
      return {
        date: bucketDate.toISOString(),
        revenue: Number(r.revenue),
        orders: Number(r.orders),
        target: matchingTarget ? Number(matchingTarget.targetRevenue) : null,
      };
    });
  }

  async getBreakdown(by: BreakdownDimension, dateFrom?: string, dateTo?: string): Promise<BreakdownEntry[]> {
    switch (by) {
      case "product":
        return this.breakdownByProduct(dateFrom, dateTo);
      case "state":
        return this.breakdownByState(dateFrom, dateTo);
      case "dealer":
        return this.breakdownByDealer(dateFrom, dateTo);
      case "executive":
        return this.breakdownByExecutive(dateFrom, dateTo);
      case "customer":
        return this.breakdownByCustomer(dateFrom, dateTo);
    }
  }

  private async breakdownByProduct(dateFrom?: string, dateTo?: string): Promise<BreakdownEntry[]> {
    const orderDateFilter = dateRangeWhere("orderDate", dateFrom, dateTo);
    const rows = await this.prisma.orderItem.groupBy({
      by: ["productId"],
      where: Object.keys(orderDateFilter).length ? { order: { is: orderDateFilter } } : undefined,
      _sum: { lineTotal: true, quantity: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 10,
    });
    const products = await this.prisma.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } } });
    return rows.map((r) => ({
      id: r.productId,
      name: products.find((p) => p.id === r.productId)?.sku ?? "Unknown",
      revenue: Number(r._sum.lineTotal ?? 0),
      orders: r._sum.quantity ?? 0,
    }));
  }

  private async breakdownByState(dateFrom?: string, dateTo?: string): Promise<BreakdownEntry[]> {
    const rows = await this.prisma.order.groupBy({
      by: ["state"],
      where: { ...NOT_CANCELLED, ...dateRangeWhere("orderDate", dateFrom, dateTo) },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    });
    return rows.map((r) => ({
      id: null,
      name: r.state,
      revenue: Number(r._sum.totalAmount ?? 0),
      orders: r._count._all,
    }));
  }

  private async breakdownByDealer(dateFrom?: string, dateTo?: string): Promise<BreakdownEntry[]> {
    const rows = await this.prisma.order.groupBy({
      by: ["dealerId"],
      where: { ...NOT_CANCELLED, dealerId: { not: null }, ...dateRangeWhere("orderDate", dateFrom, dateTo) },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    });
    const dealers = await this.prisma.dealer.findMany({
      where: { id: { in: rows.map((r) => r.dealerId).filter((id): id is string => !!id) } },
    });
    return rows.map((r) => ({
      id: r.dealerId,
      name: dealers.find((d) => d.id === r.dealerId)?.name ?? "Unknown",
      revenue: Number(r._sum.totalAmount ?? 0),
      orders: r._count._all,
    }));
  }

  private async breakdownByExecutive(dateFrom?: string, dateTo?: string): Promise<BreakdownEntry[]> {
    const rows = await this.prisma.order.groupBy({
      by: ["salesExecId"],
      where: { ...NOT_CANCELLED, salesExecId: { not: null }, ...dateRangeWhere("orderDate", dateFrom, dateTo) },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    });
    const execs = await this.prisma.salesExecutive.findMany({
      where: { id: { in: rows.map((r) => r.salesExecId).filter((id): id is string => !!id) } },
    });
    return rows.map((r) => ({
      id: r.salesExecId,
      name: execs.find((e) => e.id === r.salesExecId)?.name ?? "Unknown",
      revenue: Number(r._sum.totalAmount ?? 0),
      orders: r._count._all,
    }));
  }

  private async breakdownByCustomer(dateFrom?: string, dateTo?: string): Promise<BreakdownEntry[]> {
    const rows = await this.prisma.order.groupBy({
      by: ["customerId"],
      where: { ...NOT_CANCELLED, customerId: { not: null }, ...dateRangeWhere("orderDate", dateFrom, dateTo) },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    });
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: rows.map((r) => r.customerId).filter((id): id is string => !!id) } },
    });
    return rows.map((r) => ({
      id: r.customerId,
      name: customers.find((c) => c.id === r.customerId)?.name ?? "Unknown",
      revenue: Number(r._sum.totalAmount ?? 0),
      orders: r._count._all,
    }));
  }

  async getProductTable(query: SalesTableQueryDto): Promise<PaginatedResponse<SalesTableRow>> {
    const { page, pageSize, sortBy, sortDir, q } = query;

    const products = await this.prisma.product.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }
        : undefined,
      include: { category: true },
    });

    const itemAgg = await this.prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true, lineTotal: true },
      _count: { _all: true },
    });
    const statsByProduct = new Map(
      itemAgg.map((r) => [
        r.productId,
        { units: r._sum.quantity ?? 0, revenue: Number(r._sum.lineTotal ?? 0), orders: r._count._all },
      ]),
    );

    const totalRevenue = Array.from(statsByProduct.values()).reduce((sum, s) => sum + s.revenue, 0);

    // Growth (period-over-period) reuses the same 30-day-window comparison as Products.
    const growthByProduct = await this.getGrowthByProduct(products.map((p) => p.id));

    let rows: SalesTableRow[] = products.map((p) => {
      const s = statsByProduct.get(p.id) ?? { units: 0, revenue: 0, orders: 0 };
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        categoryName: p.category.name,
        units: s.units,
        orders: s.orders,
        revenue: s.revenue,
        growth: growthByProduct.get(p.id) ?? null,
        contributionPct: totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0,
      };
    });

    rows.sort((a, b) => {
      const key = (sortBy ?? "revenue") as keyof SalesTableRow;
      const av = (a[key] as number) ?? -Infinity;
      const bv = (b[key] as number) ?? -Infinity;
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

    const total = rows.length;
    const paged = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    return buildPaginatedResponse(paged, total, page, pageSize);
  }

  private async getGrowthByProduct(productIds: string[]): Promise<Map<string, number | null>> {
    const result = new Map<string, number | null>();
    if (productIds.length === 0) return result;

    const now = new Date();
    const currentStart = daysAgo(30, now);
    const previousStart = daysAgo(60, now);

    const [currentWindow, previousWindow] = await Promise.all([
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, order: { orderDate: { gte: currentStart } } },
        _sum: { lineTotal: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, order: { orderDate: { gte: previousStart, lt: currentStart } } },
        _sum: { lineTotal: true },
      }),
    ]);

    const currentMap = new Map(currentWindow.map((r) => [r.productId, Number(r._sum.lineTotal ?? 0)]));
    const previousMap = new Map(previousWindow.map((r) => [r.productId, Number(r._sum.lineTotal ?? 0)]));

    for (const id of productIds) {
      const current = currentMap.get(id) ?? 0;
      const previous = previousMap.get(id) ?? 0;
      result.set(id, previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : null);
    }
    return result;
  }
}

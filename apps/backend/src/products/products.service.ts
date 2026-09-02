import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CategoryBreakdownEntry,
  DemandTier,
  PaginatedResponse,
  ProductCategoryOption,
  ProductDetail,
  ProductListItem,
  ProductShadeOption,
  ProductsStatSummary,
  ProductStateDemand,
  TopEntry,
} from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { dateRangeWhere, endOfDay, getPreviousEquivalentPeriod, parseDateOnly } from "../common/utils/date-range.util";
import { ProductsListQueryDto, isComputedSortKey } from "./dto/products-list-query.dto";

const GROWTH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface ProductPerfStats {
  units: number;
  orders: number;
  revenue: number;
  growth: number | null;
}

type ProductWithRelations = Prisma.ProductGetPayload<{ include: { category: true; shade: true } }>;

@Injectable()
export class ProductsService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async findCatalog(query: ProductsListQueryDto): Promise<PaginatedResponse<ProductListItem>> {
    const { page, pageSize, sortBy, sortDir, q, categoryId, dateFrom, dateTo } = query;

    const where: Prisma.ProductWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    // Units/orders/revenue/growth are derived from OrderItem, not real columns — sorting by
    // them can't be pushed down to Postgres. At Phase-1 scale (dozens of SKUs) it's simplest
    // and honest to fetch the full filtered set, compute stats, sort in memory, then paginate
    // in memory — rather than faking a stored column just to get DB-level ORDER BY.
    if (isComputedSortKey(sortBy)) {
      const all = await this.prisma.product.findMany({ where, include: { category: true, shade: true } });
      const stats = await this.getPerformanceStats(all.map((p) => p.id), dateFrom, dateTo);
      const items = all.map((p) => this.toListItem(p, stats.get(p.id)));
      items.sort((a, b) => {
        const av = a[sortBy] ?? -Infinity;
        const bv = b[sortBy] ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      });
      const total = items.length;
      const paged = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
      return buildPaginatedResponse(paged, total, page, pageSize);
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, shade: true },
        orderBy: this.mapColumnSort(sortBy, sortDir),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    const stats = await this.getPerformanceStats(products.map((p) => p.id), dateFrom, dateTo);
    const data = products.map((p) => this.toListItem(p, stats.get(p.id)));
    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(id: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, shade: true },
    });
    if (!product) throw new NotFoundException("Product not found");

    const stats = await this.getPerformanceStats([id]);
    const demandByState = await this.getDemandByStateForProduct(id);

    return { ...this.toListItem(product, stats.get(id)), demandByState };
  }

  async getCategories(): Promise<ProductCategoryOption[]> {
    const categories = await this.prisma.productCategory.findMany({ orderBy: { name: "asc" } });
    return categories.map((c) => ({ id: c.id, name: c.name }));
  }

  async getShades(): Promise<ProductShadeOption[]> {
    const shades = await this.prisma.productShade.findMany({ orderBy: { name: "asc" } });
    return shades.map((s) => ({ id: s.id, name: s.name }));
  }

  async getStatSummary(dateFrom?: string, dateTo?: string): Promise<ProductsStatSummary> {
    const products = await this.prisma.product.findMany({ include: { category: true, shade: true } });
    const stats = await this.getPerformanceStats(products.map((p) => p.id), dateFrom, dateTo);

    let unitsSold = 0;
    let totalOrders = 0;
    let totalRevenue = 0;
    let growthSum = 0;
    let growthCount = 0;
    const byShade = new Map<string, number>();
    const byDesign = new Map<string, number>();
    const byCategory = new Map<string, number>();

    for (const p of products) {
      const s = stats.get(p.id) ?? { units: 0, orders: 0, revenue: 0, growth: null };
      unitsSold += s.units;
      totalOrders += s.orders;
      totalRevenue += s.revenue;
      if (s.growth !== null) {
        growthSum += s.growth;
        growthCount += 1;
      }
      if (p.shade) byShade.set(p.shade.name, (byShade.get(p.shade.name) ?? 0) + s.units);
      if (p.design) byDesign.set(p.design, (byDesign.get(p.design) ?? 0) + s.revenue);
      byCategory.set(p.category.name, (byCategory.get(p.category.name) ?? 0) + s.units);
    }

    return {
      totalSkus: products.length,
      unitsSold,
      totalOrders,
      totalRevenue,
      avgGrowth: growthCount > 0 ? growthSum / growthCount : null,
      bestSellingShade: this.topEntry(byShade, unitsSold),
      bestSellingDesign: this.topEntry(byDesign, totalRevenue),
      highestDemandCategory: this.topEntry(byCategory, unitsSold),
    };
  }

  async getCategoryBreakdown(dateFrom?: string, dateTo?: string): Promise<CategoryBreakdownEntry[]> {
    const categories = await this.prisma.productCategory.findMany({
      include: { products: true },
      orderBy: { name: "asc" },
    });

    const results: CategoryBreakdownEntry[] = [];
    for (const category of categories) {
      const stats = await this.getPerformanceStats(category.products.map((p) => p.id), dateFrom, dateTo);
      let units = 0;
      let revenue = 0;
      for (const s of stats.values()) {
        units += s.units;
        revenue += s.revenue;
      }
      results.push({ categoryId: category.id, categoryName: category.name, skuCount: category.products.length, units, revenue });
    }
    return results.sort((a, b) => b.revenue - a.revenue);
  }

  async getNeedsAttention(dateFrom?: string, dateTo?: string): Promise<ProductListItem[]> {
    const products = await this.prisma.product.findMany({ include: { category: true, shade: true } });
    const stats = await this.getPerformanceStats(products.map((p) => p.id), dateFrom, dateTo);
    return products
      .map((p) => this.toListItem(p, stats.get(p.id)))
      .filter((p) => p.growth !== null && p.growth < 0)
      .sort((a, b) => (a.growth ?? 0) - (b.growth ?? 0));
  }

  private topEntry(counts: Map<string, number>, total: number): TopEntry | null {
    if (counts.size === 0) return null;
    let bestName = "";
    let bestValue = -Infinity;
    for (const [name, value] of counts) {
      if (value > bestValue) {
        bestName = name;
        bestValue = value;
      }
    }
    return { name: bestName, value: bestValue, pctOfTotal: total > 0 ? (bestValue / total) * 100 : 0 };
  }

  private mapColumnSort(sortBy: string | undefined, sortDir: "asc" | "desc"): Prisma.ProductOrderByWithRelationInput {
    switch (sortBy) {
      case "sku":
        return { sku: sortDir };
      case "category":
        return { category: { name: sortDir } };
      case "name":
      default:
        return { name: sortDir };
    }
  }

  private toListItem(product: ProductWithRelations, stats?: ProductPerfStats): ProductListItem {
    const s = stats ?? { units: 0, orders: 0, revenue: 0, growth: null };
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      shadeId: product.shadeId,
      shadeName: product.shade?.name ?? null,
      design: product.design,
      unitPrice: Number(product.unitPrice),
      units: s.units,
      orders: s.orders,
      revenue: s.revenue,
      growth: s.growth,
      demandTier: this.demandTier(s.units),
    };
  }

  private demandTier(units: number): DemandTier {
    if (units >= 250) return "High";
    if (units >= 80) return "Medium";
    return "Low";
  }

  private async getPerformanceStats(
    productIds: string[],
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Map<string, ProductPerfStats>> {
    const result = new Map<string, ProductPerfStats>();
    if (productIds.length === 0) return result;

    const now = new Date();
    let currentOrderDate: Prisma.DateTimeFilter;
    let previousOrderDate: Prisma.DateTimeFilter;
    if (dateFrom || dateTo) {
      const current = { from: dateFrom ? parseDateOnly(dateFrom) : new Date(0), to: dateTo ? parseDateOnly(dateTo) : now };
      const previous = getPreviousEquivalentPeriod(current);
      currentOrderDate = { gte: current.from, lte: endOfDay(current.to) };
      previousOrderDate = { gte: previous.from, lte: endOfDay(previous.to) };
    } else {
      const currentStart = new Date(now.getTime() - GROWTH_WINDOW_MS);
      const previousStart = new Date(now.getTime() - 2 * GROWTH_WINDOW_MS);
      currentOrderDate = { gte: currentStart };
      previousOrderDate = { gte: previousStart, lt: currentStart };
    }
    // "Lifetime" totals become range-scoped once a range is supplied — omitting dateFrom/dateTo
    // keeps the true lifetime aggregate this method returned before.
    const rangeFilter = dateRangeWhere("orderDate", dateFrom, dateTo);
    const lifetimeWhere = Object.keys(rangeFilter).length
      ? { productId: { in: productIds }, order: { is: rangeFilter } }
      : { productId: { in: productIds } };

    const [lifetime, currentWindow, previousWindow] = await Promise.all([
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: lifetimeWhere,
        _sum: { quantity: true, lineTotal: true },
        _count: { _all: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, order: { orderDate: currentOrderDate } },
        _sum: { lineTotal: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, order: { orderDate: previousOrderDate } },
        _sum: { lineTotal: true },
      }),
    ]);

    const currentByProduct = new Map(currentWindow.map((r) => [r.productId, Number(r._sum.lineTotal ?? 0)]));
    const previousByProduct = new Map(previousWindow.map((r) => [r.productId, Number(r._sum.lineTotal ?? 0)]));

    for (const row of lifetime) {
      const current = currentByProduct.get(row.productId) ?? 0;
      const previous = previousByProduct.get(row.productId) ?? 0;
      const growth = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : null;

      result.set(row.productId, {
        units: row._sum.quantity ?? 0,
        orders: row._count._all,
        revenue: Number(row._sum.lineTotal ?? 0),
        growth,
      });
    }

    return result;
  }

  private async getDemandByStateForProduct(productId: string): Promise<ProductStateDemand[]> {
    const rows = await this.prisma.orderItem.findMany({
      where: { productId },
      select: { quantity: true, order: { select: { state: true } } },
    });

    const byState = new Map<string, number>();
    let total = 0;
    for (const row of rows) {
      byState.set(row.order.state, (byState.get(row.order.state) ?? 0) + row.quantity);
      total += row.quantity;
    }

    return Array.from(byState.entries())
      .map(([state, units]) => ({ state, units, pct: total > 0 ? (units / total) * 100 : 0 }))
      .sort((a, b) => b.units - a.units);
  }
}

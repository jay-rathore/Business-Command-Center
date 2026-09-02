import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma, SalesTargetScope } from "@prisma/client";
import { PaginatedResponse, SalesTargetItem } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { SalesTargetsListQueryDto } from "./dto/sales-targets-list-query.dto";
import { UpsertSalesTargetDto } from "./dto/upsert-sales-target.dto";

const NOT_CANCELLED: Prisma.OrderWhereInput = { status: { not: OrderStatus.CANCELLED } };

type SalesTargetRow = Prisma.SalesTargetGetPayload<{
  include: { salesExecutive: true; dealer: true; productCategory: true };
}>;

@Injectable()
export class SalesTargetsService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async findAll(query: SalesTargetsListQueryDto): Promise<PaginatedResponse<SalesTargetItem>> {
    const { scope, page, pageSize } = query;
    const where: Prisma.SalesTargetWhereInput = { ...(scope ? { scope } : {}) };

    const [targets, total] = await Promise.all([
      this.prisma.salesTarget.findMany({
        where,
        include: { salesExecutive: true, dealer: true, productCategory: true },
        orderBy: { periodStart: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.salesTarget.count({ where }),
    ]);

    const data = await Promise.all(targets.map((t) => this.toItem(t)));
    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async create(dto: UpsertSalesTargetDto): Promise<SalesTargetItem> {
    this.validateScope(dto);
    const target = await this.prisma.salesTarget.create({
      data: this.toCreateData(dto),
      include: { salesExecutive: true, dealer: true, productCategory: true },
    });
    return this.toItem(target);
  }

  async update(id: string, dto: UpsertSalesTargetDto): Promise<SalesTargetItem> {
    this.validateScope(dto);
    const existing = await this.prisma.salesTarget.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Sales target not found");

    const target = await this.prisma.salesTarget.update({
      where: { id },
      data: this.toCreateData(dto),
      include: { salesExecutive: true, dealer: true, productCategory: true },
    });
    return this.toItem(target);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.salesTarget.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Sales target not found");
    await this.prisma.salesTarget.delete({ where: { id } });
  }

  private validateScope(dto: UpsertSalesTargetDto): void {
    if (new Date(dto.periodEnd) <= new Date(dto.periodStart)) {
      throw new BadRequestException("periodEnd must be after periodStart");
    }

    const scopeIds = [dto.salesExecutiveId, dto.dealerId, dto.productCategoryId].filter((id) => id != null);
    if (dto.scope === SalesTargetScope.COMPANY) {
      if (scopeIds.length > 0) {
        throw new BadRequestException("salesExecutiveId/dealerId/productCategoryId must be unset for a COMPANY-scope target");
      }
      return;
    }

    if (scopeIds.length !== 1) {
      throw new BadRequestException("Exactly one of salesExecutiveId/dealerId/productCategoryId must be set for a non-COMPANY scope");
    }
    if (dto.scope === SalesTargetScope.SALES_EXECUTIVE && !dto.salesExecutiveId) {
      throw new BadRequestException("salesExecutiveId is required for a SALES_EXECUTIVE-scope target");
    }
    if (dto.scope === SalesTargetScope.DEALER && !dto.dealerId) {
      throw new BadRequestException("dealerId is required for a DEALER-scope target");
    }
    if (dto.scope === SalesTargetScope.PRODUCT_CATEGORY && !dto.productCategoryId) {
      throw new BadRequestException("productCategoryId is required for a PRODUCT_CATEGORY-scope target");
    }
  }

  private toCreateData(dto: UpsertSalesTargetDto): Prisma.SalesTargetUncheckedCreateInput {
    return {
      organizationId: TenantContext.get().organizationId,
      scope: dto.scope,
      salesExecutiveId: dto.scope === SalesTargetScope.SALES_EXECUTIVE ? dto.salesExecutiveId! : null,
      dealerId: dto.scope === SalesTargetScope.DEALER ? dto.dealerId! : null,
      productCategoryId: dto.scope === SalesTargetScope.PRODUCT_CATEGORY ? dto.productCategoryId! : null,
      periodType: dto.periodType,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      targetRevenue: dto.targetRevenue,
      targetOrders: dto.targetOrders ?? null,
    };
  }

  private async computeAchievement(target: SalesTargetRow): Promise<{ achievedRevenue: number; achievedOrders: number | null }> {
    const period: Prisma.OrderWhereInput = {
      ...NOT_CANCELLED,
      orderDate: { gte: target.periodStart, lte: target.periodEnd },
    };

    switch (target.scope) {
      case SalesTargetScope.COMPANY: {
        const agg = await this.prisma.order.aggregate({ where: period, _sum: { totalAmount: true }, _count: { _all: true } });
        return { achievedRevenue: Number(agg._sum.totalAmount ?? 0), achievedOrders: agg._count._all };
      }
      case SalesTargetScope.SALES_EXECUTIVE: {
        const agg = await this.prisma.order.aggregate({
          where: { ...period, salesExecId: target.salesExecutiveId },
          _sum: { totalAmount: true },
          _count: { _all: true },
        });
        return { achievedRevenue: Number(agg._sum.totalAmount ?? 0), achievedOrders: agg._count._all };
      }
      case SalesTargetScope.DEALER: {
        const agg = await this.prisma.order.aggregate({
          where: { ...period, dealerId: target.dealerId },
          _sum: { totalAmount: true },
          _count: { _all: true },
        });
        return { achievedRevenue: Number(agg._sum.totalAmount ?? 0), achievedOrders: agg._count._all };
      }
      case SalesTargetScope.PRODUCT_CATEGORY: {
        // An order can span categories, so "orders achieved" isn't a clean number here —
        // only revenue achievement is shown for this scope.
        const agg = await this.prisma.orderItem.aggregate({
          where: { product: { categoryId: target.productCategoryId! }, order: period },
          _sum: { lineTotal: true },
        });
        return { achievedRevenue: Number(agg._sum.lineTotal ?? 0), achievedOrders: null };
      }
    }
  }

  private async toItem(target: SalesTargetRow): Promise<SalesTargetItem> {
    const { achievedRevenue, achievedOrders } = await this.computeAchievement(target);
    const targetRevenue = Number(target.targetRevenue);
    return {
      id: target.id,
      scope: target.scope,
      salesExecutiveId: target.salesExecutiveId,
      salesExecutiveName: target.salesExecutive?.name ?? null,
      dealerId: target.dealerId,
      dealerName: target.dealer?.name ?? null,
      productCategoryId: target.productCategoryId,
      productCategoryName: target.productCategory?.name ?? null,
      periodType: target.periodType,
      periodStart: target.periodStart.toISOString(),
      periodEnd: target.periodEnd.toISOString(),
      targetRevenue,
      targetOrders: target.targetOrders,
      achievedRevenue,
      achievedOrders,
      achievementPct: targetRevenue > 0 ? (achievedRevenue / targetRevenue) * 100 : null,
    };
  }
}

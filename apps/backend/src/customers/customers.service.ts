import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ComplaintStatus, OrderStatus, Prisma, WarrantyClaimStatus } from "@prisma/client";
import { CustomerDetail, CustomerLeaderboardEntry, CustomerListItem, CustomersKpis, CustomerSegment, PaginatedResponse } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { startOfMonth } from "../common/utils/date";
import { CustomersListQueryDto, isCustomerComputedSortKey } from "./dto/customers-list-query.dto";
import { CustomerMetricsService } from "./customer-metrics.service";
import { deriveCustomerSegment } from "./customer-segment";

const NOT_CANCELLED: Prisma.OrderWhereInput = { status: { not: OrderStatus.CANCELLED } };
const OPEN_COMPLAINT: Prisma.ComplaintWhereInput = { status: { notIn: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] } };
const ACTIVE_WARRANTY_CLAIM: Prisma.WarrantyClaimWhereInput = {
  status: { notIn: [WarrantyClaimStatus.RESOLVED, WarrantyClaimStatus.REJECTED] },
};

type CustomerRow = Prisma.CustomerGetPayload<{}>;

@Injectable()
export class CustomersService {
  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly metrics: CustomerMetricsService,
  ) {}

  async findAll(query: CustomersListQueryDto): Promise<PaginatedResponse<CustomerListItem>> {
    const { page, pageSize, sortBy, sortDir, q, segment, type, state } = query;

    const where: Prisma.CustomerWhereInput = {
      ...(type ? { type } : {}),
      ...(state ? { state } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { customerCode: { contains: q, mode: "insensitive" as const } },
              { companyName: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    if (segment || isCustomerComputedSortKey(sortBy)) {
      const all = await this.prisma.customer.findMany({ where });
      const counts = await this.getOrderCounts(all.map((c) => c.id));
      let items = all.map((c) => this.toListItem(c, counts.get(c.id) ?? 0));
      if (segment) items = items.filter((c) => c.segment === segment);
      items.sort((a, b) => {
        const av = a.segment;
        const bv = b.segment;
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      const total = items.length;
      const paged = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
      return buildPaginatedResponse(paged, total, page, pageSize);
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: this.mapColumnSort(sortBy, sortDir),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    const counts = await this.getOrderCounts(customers.map((c) => c.id));
    const data = customers.map((c) => this.toListItem(c, counts.get(c.id) ?? 0));
    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(id: string): Promise<CustomerDetail> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException("Customer not found");

    const [totalOrders, openComplaints, activeWarrantyClaims, recentOrders, recentComplaints, recentWarrantyClaims] = await Promise.all([
      this.prisma.order.count({ where: { customerId: id, ...NOT_CANCELLED } }),
      this.prisma.complaint.count({ where: { customerId: id, ...OPEN_COMPLAINT } }),
      this.prisma.warrantyClaim.count({ where: { customerId: id, ...ACTIVE_WARRANTY_CLAIM } }),
      this.prisma.order.findMany({ where: { customerId: id }, orderBy: { orderDate: "desc" }, take: 5 }),
      this.prisma.complaint.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.warrantyClaim.findMany({ where: { customerId: id }, orderBy: { claimDate: "desc" }, take: 5 }),
    ]);

    const listItem = this.toListItem(customer, totalOrders);

    return {
      ...listItem,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      satisfactionScore: customer.satisfactionScore,
      openComplaints,
      activeWarrantyClaims,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        orderDate: o.orderDate.toISOString(),
        status: o.status,
        totalAmount: Number(o.totalAmount),
      })),
      recentComplaints: recentComplaints.map((c) => ({
        id: c.id,
        complaintCode: c.complaintCode,
        issue: c.issue,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
      recentWarrantyClaims: recentWarrantyClaims.map((w) => ({
        id: w.id,
        claimCode: w.claimCode,
        status: w.status,
        claimDate: w.claimDate.toISOString(),
      })),
    };
  }

  async getKpis(): Promise<CustomersKpis> {
    const all = await this.prisma.customer.findMany({
      select: { id: true, lifetimeValue: true, lastPurchaseAt: true, firstPurchaseAt: true, createdAt: true },
    });

    let totalLifetimeValue = 0;
    let activeCustomers = 0;
    let atRiskCustomers = 0;
    let dormantCustomers = 0;
    const monthStart = startOfMonth(new Date());
    let newThisMonth = 0;

    for (const c of all) {
      totalLifetimeValue += Number(c.lifetimeValue);
      if (c.createdAt >= monthStart) newThisMonth += 1;
      const segment = deriveCustomerSegment(c.lastPurchaseAt, c.firstPurchaseAt, c.createdAt);
      if (segment === "ACTIVE") activeCustomers += 1;
      else if (segment === "AT_RISK") atRiskCustomers += 1;
      else if (segment === "DORMANT") dormantCustomers += 1;
    }

    const [openComplaints, activeWarrantyClaims] = await Promise.all([
      this.prisma.complaint.count({ where: OPEN_COMPLAINT }),
      this.prisma.warrantyClaim.count({ where: ACTIVE_WARRANTY_CLAIM }),
    ]);

    return {
      totalCustomers: all.length,
      newThisMonth,
      totalLifetimeValue,
      avgLifetimeValue: all.length > 0 ? totalLifetimeValue / all.length : 0,
      activeCustomers,
      atRiskCustomers,
      dormantCustomers,
      openComplaints,
      activeWarrantyClaims,
    };
  }

  async getLeaderboard(): Promise<CustomerLeaderboardEntry[]> {
    const customers = await this.prisma.customer.findMany({ orderBy: { lifetimeValue: "desc" }, take: 5 });
    const counts = await this.getOrderCounts(customers.map((c) => c.id));
    return customers.map((c) => ({
      id: c.id,
      name: c.name,
      lifetimeValue: Number(c.lifetimeValue),
      totalOrders: counts.get(c.id) ?? 0,
      segment: deriveCustomerSegment(c.lastPurchaseAt, c.firstPurchaseAt, c.createdAt),
    }));
  }

  async getAtRisk(): Promise<CustomerListItem[]> {
    const all = await this.prisma.customer.findMany();
    const counts = await this.getOrderCounts(all.map((c) => c.id));
    return all
      .map((c) => this.toListItem(c, counts.get(c.id) ?? 0))
      .filter((c) => c.segment === "AT_RISK" || c.segment === "DORMANT")
      .sort((a, b) => {
        const at = a.lastPurchaseAt ? new Date(a.lastPurchaseAt).getTime() : -Infinity;
        const bt = b.lastPurchaseAt ? new Date(b.lastPurchaseAt).getTime() : -Infinity;
        return at - bt;
      })
      .slice(0, 8);
  }

  async recomputeMetrics(id: string): Promise<CustomerDetail> {
    await this.metrics.recomputeOne(id);
    return this.findOne(id);
  }

  private mapColumnSort(sortBy: string | undefined, sortDir: "asc" | "desc"): Prisma.CustomerOrderByWithRelationInput {
    switch (sortBy) {
      case "city":
        return { city: sortDir };
      case "state":
        return { state: sortDir };
      case "lifetimeValue":
        return { lifetimeValue: sortDir };
      case "lastPurchaseAt":
        return { lastPurchaseAt: sortDir };
      case "createdAt":
        return { createdAt: sortDir };
      case "name":
      default:
        return { name: sortDir };
    }
  }

  private toListItem(customer: CustomerRow, totalOrders: number): CustomerListItem {
    const segment: CustomerSegment = deriveCustomerSegment(customer.lastPurchaseAt, customer.firstPurchaseAt, customer.createdAt);
    return {
      id: customer.id,
      customerCode: customer.customerCode,
      name: customer.name,
      companyName: customer.companyName,
      type: customer.type,
      phone: customer.phone,
      city: customer.city,
      state: customer.state,
      lifetimeValue: Number(customer.lifetimeValue),
      firstPurchaseAt: customer.firstPurchaseAt?.toISOString() ?? null,
      lastPurchaseAt: customer.lastPurchaseAt?.toISOString() ?? null,
      segment,
      totalOrders,
    };
  }

  private async getOrderCounts(customerIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (customerIds.length === 0) return result;

    const counts = await this.prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { in: customerIds }, ...NOT_CANCELLED },
      _count: { _all: true },
    });
    for (const c of counts) {
      if (c.customerId) result.set(c.customerId, c._count._all);
    }
    return result;
  }
}

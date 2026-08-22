import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderStatus } from "@prisma/client";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";

/** Keeps Customer.lifetimeValue / firstPurchaseAt / lastPurchaseAt in sync with their Orders.
 * Mirrors DealerScoringService's bootstrap+cron caching pattern, but with no scoring/weights —
 * these are plain aggregates, not a derived score. */
@Injectable()
export class CustomerMetricsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CustomerMetricsService.name);

  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async onApplicationBootstrap() {
    await this.recomputeAll();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async recomputeAllCron() {
    await this.recomputeAll();
  }

  async recomputeAll(): Promise<number> {
    const customers = await this.prisma.customer.findMany({ select: { id: true } });
    if (customers.length === 0) return 0;

    await this.applyMetrics(customers.map((c) => c.id));
    this.logger.log(`Recomputed metrics for ${customers.length} customers`);
    return customers.length;
  }

  async recomputeOne(customerId: string): Promise<void> {
    await this.applyMetrics([customerId]);
  }

  private async applyMetrics(customerIds: string[]): Promise<void> {
    const aggregates = await this.prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { in: customerIds }, status: { not: OrderStatus.CANCELLED } },
      _sum: { totalAmount: true },
      _min: { orderDate: true },
      _max: { orderDate: true },
    });

    const byCustomer = new Map(aggregates.filter((a) => a.customerId).map((a) => [a.customerId as string, a]));

    await Promise.all(
      customerIds.map((id) => {
        const agg = byCustomer.get(id);
        return this.prisma.customer.update({
          where: { id },
          data: {
            lifetimeValue: Number(agg?._sum.totalAmount ?? 0),
            firstPurchaseAt: agg?._min.orderDate ?? null,
            lastPurchaseAt: agg?._max.orderDate ?? null,
          },
        });
      }),
    );
  }
}

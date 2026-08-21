import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OnApplicationBootstrap } from "@nestjs/common";
import { DealerStatus, OrderStatus } from "@prisma/client";
import { DealerHealthBreakdown } from "@hpl/shared";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { daysAgo } from "../common/utils/date";

const WEIGHTS = { recency: 0.3, frequency: 0.25, revenue: 0.25, growth: 0.2 };
const NEW_DEALER_WINDOW_DAYS = 30;

interface DealerScoreInputs {
  dealerId: string;
  joinedAt: Date;
  lifetimeOrderCount: number;
  lastOrderAt: Date | null;
  trailing30dRevenue: number;
  previous30dRevenue: number;
}

/** Computes each Dealer's weighted 0-100 health score — Recency 30% / Frequency 25% /
 * Revenue 25% (percentile within the batch being scored) / Growth 20% — and derives
 * DealerStatus from it. Results are cached on the Dealer row (healthScore,
 * healthScoreBreakdown, healthScoreUpdatedAt), never computed live on read. */
@Injectable()
export class DealerScoringService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DealerScoringService.name);

  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async onApplicationBootstrap() {
    // Ensures scores are populated immediately on a fresh seed/dev boot, rather than
    // waiting for the nightly cron.
    await this.recomputeAll();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async recomputeAllCron() {
    await this.recomputeAll();
  }

  async recomputeAll(): Promise<number> {
    const dealers = await this.prisma.dealer.findMany({ select: { id: true, joinedAt: true } });
    if (dealers.length === 0) return 0;

    const inputs = await this.gatherInputs(dealers.map((d) => d.id));
    const revenueValues = inputs.map((i) => i.trailing30dRevenue);

    for (const input of inputs) {
      const dealer = dealers.find((d) => d.id === input.dealerId)!;
      await this.applyScore(dealer.id, dealer.joinedAt, input, revenueValues);
    }

    this.logger.log(`Recomputed health scores for ${inputs.length} dealers`);
    return inputs.length;
  }

  async recomputeOne(dealerId: string): Promise<void> {
    const dealer = await this.prisma.dealer.findUniqueOrThrow({ where: { id: dealerId }, select: { id: true, joinedAt: true } });
    // Revenue percentile still needs the full batch for a meaningful bucket.
    const allDealers = await this.prisma.dealer.findMany({ select: { id: true } });
    const inputs = await this.gatherInputs(allDealers.map((d) => d.id));
    const revenueValues = inputs.map((i) => i.trailing30dRevenue);
    const input = inputs.find((i) => i.dealerId === dealerId)!;
    await this.applyScore(dealer.id, dealer.joinedAt, input, revenueValues);
  }

  private async gatherInputs(dealerIds: string[]): Promise<DealerScoreInputs[]> {
    const now = new Date();
    const currentStart = daysAgo(30, now);
    const previousStart = daysAgo(60, now);

    const [lifetime, lastOrder, currentRevenue, previousRevenue] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["dealerId"],
        where: { dealerId: { in: dealerIds }, status: { not: OrderStatus.CANCELLED } },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ["dealerId"],
        where: { dealerId: { in: dealerIds }, status: { not: OrderStatus.CANCELLED } },
        _max: { orderDate: true },
      }),
      this.prisma.order.groupBy({
        by: ["dealerId"],
        where: { dealerId: { in: dealerIds }, status: { not: OrderStatus.CANCELLED }, orderDate: { gte: currentStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ["dealerId"],
        where: {
          dealerId: { in: dealerIds },
          status: { not: OrderStatus.CANCELLED },
          orderDate: { gte: previousStart, lt: currentStart },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    const lifetimeMap = new Map(lifetime.map((r) => [r.dealerId, r._count._all]));
    const lastOrderMap = new Map(lastOrder.map((r) => [r.dealerId, r._max.orderDate]));
    const currentRevMap = new Map(currentRevenue.map((r) => [r.dealerId, Number(r._sum.totalAmount ?? 0)]));
    const previousRevMap = new Map(previousRevenue.map((r) => [r.dealerId, Number(r._sum.totalAmount ?? 0)]));

    const dealers = await this.prisma.dealer.findMany({ where: { id: { in: dealerIds } }, select: { id: true, joinedAt: true } });

    return dealers.map((d) => ({
      dealerId: d.id,
      joinedAt: d.joinedAt,
      lifetimeOrderCount: lifetimeMap.get(d.id) ?? 0,
      lastOrderAt: lastOrderMap.get(d.id) ?? null,
      trailing30dRevenue: currentRevMap.get(d.id) ?? 0,
      previous30dRevenue: previousRevMap.get(d.id) ?? 0,
    }));
  }

  private async applyScore(
    dealerId: string,
    joinedAt: Date,
    input: DealerScoreInputs,
    batchRevenueValues: number[],
  ): Promise<void> {
    const now = new Date();
    const daysSinceLastOrder = input.lastOrderAt
      ? Math.round((now.getTime() - input.lastOrderAt.getTime()) / 86400000)
      : null;
    const tenureYears = (now.getTime() - joinedAt.getTime()) / (365.25 * 86400000);

    // Recency (30%)
    let recencyScore: number;
    let recentActivityLabel: string;
    if (daysSinceLastOrder === null) {
      recencyScore = 0;
      recentActivityLabel = "No orders yet";
    } else if (daysSinceLastOrder <= 14) {
      recencyScore = 100;
      recentActivityLabel = "Active";
    } else if (daysSinceLastOrder <= 45) {
      recencyScore = 60;
      recentActivityLabel = "Slowing";
    } else if (daysSinceLastOrder <= 90) {
      recencyScore = 30;
      recentActivityLabel = "Cooling off";
    } else {
      recencyScore = 0;
      recentActivityLabel = "Dormant";
    }

    // Frequency (25%) — lifetime order count tiers.
    let frequencyScore: number;
    let frequencyLabel: string;
    if (input.lifetimeOrderCount >= 100) {
      frequencyScore = 100;
      frequencyLabel = "Very regular";
    } else if (input.lifetimeOrderCount >= 60) {
      frequencyScore = 75;
      frequencyLabel = "Regular";
    } else if (input.lifetimeOrderCount >= 30) {
      frequencyScore = 50;
      frequencyLabel = "Occasional";
    } else {
      frequencyScore = 25;
      frequencyLabel = "Rare";
    }

    // Revenue (25%) — percentile within the batch being scored (thirds).
    const sorted = [...batchRevenueValues].sort((a, b) => a - b);
    const rank = sorted.findIndex((v) => v >= input.trailing30dRevenue);
    const percentile = sorted.length > 1 ? rank / (sorted.length - 1) : 1;
    let revenueScore: number;
    let revenueLabel: string;
    if (percentile >= 0.66) {
      revenueScore = 100;
      revenueLabel = "High";
    } else if (percentile >= 0.33) {
      revenueScore = 60;
      revenueLabel = "Medium";
    } else {
      revenueScore = 30;
      revenueLabel = "Low";
    }

    // Growth (20%) — MoM revenue growth.
    let growthPct: number | null = null;
    let growthScore: number;
    let growthLabel: string;
    if (input.previous30dRevenue === 0 && input.trailing30dRevenue === 0) {
      growthScore = 50;
      growthLabel = "Too new to trend";
    } else if (input.previous30dRevenue === 0) {
      growthPct = 100;
      growthScore = 100;
      growthLabel = "Growing";
    } else {
      growthPct = ((input.trailing30dRevenue - input.previous30dRevenue) / input.previous30dRevenue) * 100;
      if (growthPct > 10) {
        growthScore = 100;
        growthLabel = "Growing";
      } else if (growthPct > 0) {
        growthScore = 70;
        growthLabel = "Growing";
      } else if (growthPct > -15) {
        growthScore = 40;
        growthLabel = "Softening";
      } else {
        growthScore = 10;
        growthLabel = "Declining";
      }
    }

    // Recency/tenure narrative (not part of the weighted score — informational).
    let recencyTenureLabel: string;
    if (tenureYears >= 3) recencyTenureLabel = "Loyal partner";
    else if (tenureYears >= 1) recencyTenureLabel = "Established";
    else recencyTenureLabel = "New relationship";

    const healthScore = Math.round(
      recencyScore * WEIGHTS.recency +
        frequencyScore * WEIGHTS.frequency +
        revenueScore * WEIGHTS.revenue +
        growthScore * WEIGHTS.growth,
    );

    const isNew = now.getTime() - joinedAt.getTime() <= NEW_DEALER_WINDOW_DAYS * 86400000;
    let status: DealerStatus;
    if (isNew) status = DealerStatus.NEW;
    else if (healthScore >= 70) status = DealerStatus.ACTIVE;
    else if (healthScore >= 40) status = DealerStatus.AT_RISK;
    else status = DealerStatus.INACTIVE;

    const breakdown: DealerHealthBreakdown = {
      orderFrequency: { label: frequencyLabel, score: frequencyScore, orderCount: input.lifetimeOrderCount },
      revenue: { label: revenueLabel, score: revenueScore, trailing30dRevenue: input.trailing30dRevenue },
      recentActivity: { label: recentActivityLabel, score: recencyScore, daysSinceLastOrder },
      growth: { label: growthLabel, score: growthScore, growthPct },
      recency: { label: recencyTenureLabel, score: 0, tenureYears: Math.round(tenureYears * 10) / 10 },
    };

    await this.prisma.dealer.update({
      where: { id: dealerId },
      data: {
        healthScore,
        healthScoreBreakdown: breakdown as object,
        healthScoreUpdatedAt: now,
        status,
      },
    });
  }
}

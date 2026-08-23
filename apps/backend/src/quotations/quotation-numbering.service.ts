import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";

/** Generates race-free sequential quotation reference numbers (PI-2026-0001, ...) per tenant,
 * by transactionally incrementing that tenant's QuotationCounter row (organizationId is its
 * primary key). Kept as its own small provider — same "split out a focused service" pattern
 * as DealerScoringService. */
@Injectable()
export class QuotationNumberingService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async next(): Promise<string> {
    const organizationId = TenantContext.get().organizationId;
    const counter = await this.prisma.$transaction(async (tx) => {
      return tx.quotationCounter.upsert({
        where: { organizationId },
        create: { organizationId, seq: 1 },
        update: { seq: { increment: 1 } },
      });
    });
    const year = new Date().getFullYear();
    return `PI-${year}-${String(counter.seq).padStart(4, "0")}`;
  }
}

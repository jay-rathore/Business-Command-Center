import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";

const COUNTER_ID = "global";

/** Generates race-free sequential quotation reference numbers (PI-2026-0001, ...) by
 * transactionally incrementing a single QuotationCounter row. Kept as its own small provider —
 * same "split out a focused service" pattern as DealerScoringService. */
@Injectable()
export class QuotationNumberingService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async next(): Promise<string> {
    const counter = await this.prisma.$transaction(async (tx) => {
      return tx.quotationCounter.upsert({
        where: { id: COUNTER_ID },
        create: { id: COUNTER_ID, seq: 1 },
        update: { seq: { increment: 1 } },
      });
    });
    const year = new Date().getFullYear();
    return `PI-${year}-${String(counter.seq).padStart(4, "0")}`;
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";

const COUNTER_ID = "global";

/** Generates race-free sequential lead codes (CARD-2026-0001, ...) for leads created via
 * business-card scanning, by transactionally incrementing a single LeadCounter row. Mirrors
 * QuotationNumberingService. The "CARD-" prefix distinguishes these from CRM-synced leads
 * (whose leadCode instead derives from the external CRM id) at a glance in the lead list. */
@Injectable()
export class LeadCodingService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async next(): Promise<string> {
    const counter = await this.prisma.$transaction(async (tx) => {
      return tx.leadCounter.upsert({
        where: { id: COUNTER_ID },
        create: { id: COUNTER_ID, seq: 1 },
        update: { seq: { increment: 1 } },
      });
    });
    const year = new Date().getFullYear();
    return `CARD-${year}-${String(counter.seq).padStart(4, "0")}`;
  }
}

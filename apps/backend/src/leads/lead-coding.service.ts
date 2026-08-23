import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";

/** Generates race-free sequential lead codes (CARD-2026-0001, ...) per tenant for leads
 * created via business-card scanning, by transactionally incrementing that tenant's
 * LeadCounter row (organizationId is its primary key). Mirrors QuotationNumberingService.
 * The "CARD-" prefix distinguishes these from CRM-synced leads (whose leadCode instead
 * derives from the external CRM id) at a glance in the lead list. */
@Injectable()
export class LeadCodingService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async next(): Promise<string> {
    const organizationId = TenantContext.get().organizationId;
    const counter = await this.prisma.$transaction(async (tx) => {
      return tx.leadCounter.upsert({
        where: { organizationId },
        create: { organizationId, seq: 1 },
        update: { seq: { increment: 1 } },
      });
    });
    const year = new Date().getFullYear();
    return `CARD-${year}-${String(counter.seq).padStart(4, "0")}`;
  }
}

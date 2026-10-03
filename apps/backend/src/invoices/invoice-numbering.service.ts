import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_EXTENDED_CLIENT } from "../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../prisma/prisma-extended.provider";
import { TenantContext } from "../common/context/tenant-context";

/** Race-free sequential invoice numbers (INV-2026-0001, ...) per tenant — same approach as
 * QuotationNumberingService: transactionally increment the tenant's InvoiceCounter row. */
@Injectable()
export class InvoiceNumberingService {
  constructor(@Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient) {}

  async next(): Promise<string> {
    const organizationId = TenantContext.get().organizationId;
    const counter = await this.prisma.$transaction(async (tx) => {
      return tx.invoiceCounter.upsert({
        where: { organizationId },
        create: { organizationId, seq: 1 },
        update: { seq: { increment: 1 } },
      });
    });
    return `INV-${new Date().getFullYear()}-${String(counter.seq).padStart(4, "0")}`;
  }
}

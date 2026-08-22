import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";
import { mapWcProduct, WcProductRaw } from "./wc-product-mapper";

const EXTERIOR_CLADDING_CATEGORY = "Exterior Cladding";

export interface WcSyncResult {
  processed: number;
  created: number;
  updated: number;
}

/** Pulls the real product catalog from the business's live WooCommerce store (hplmaker.com)
 * and upserts it by wcId, additively, alongside the fabricated seed.ts catalog — never
 * deletes, mirrors CrmSyncService's (../../leads/crm-sync/crm-sync.service.ts) approach for
 * the same reason: existing Order/Complaint/WarrantyClaim rows already reference fabricated
 * Product rows and must not be orphaned. */
@Injectable()
export class WcSyncService {
  private readonly logger = new Logger(WcSyncService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledSync(): Promise<void> {
    try {
      const result = await this.syncNow();
      this.logger.log(`WooCommerce sync: ${result.processed} products processed (${result.created} new, ${result.updated} updated)`);
    } catch (err) {
      this.logger.error(`WooCommerce sync failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async syncNow(): Promise<WcSyncResult> {
    const baseUrl = this.config.getOrThrow<string>("WOOCOMMERCE_URL");
    const key = this.config.getOrThrow<string>("WOOCOMMERCE_CONSUMER_KEY");
    const secret = this.config.getOrThrow<string>("WOOCOMMERCE_CONSUMER_SECRET");
    const auth = Buffer.from(`${key}:${secret}`).toString("base64");

    const category = await this.prisma.productCategory.findUniqueOrThrow({ where: { name: EXTERIOR_CLADDING_CATEGORY } });

    const res = await fetch(`${baseUrl}/wp-json/wc/v3/products?per_page=100&status=publish`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error(`WooCommerce API returned ${res.status}`);
    const products = (await res.json()) as WcProductRaw[];

    let created = 0;
    let updated = 0;

    for (const raw of products) {
      const mapped = mapWcProduct(raw);
      const existing = await this.prisma.product.findUnique({ where: { wcId: mapped.wcId }, select: { id: true } });

      await this.prisma.product.upsert({
        where: { wcId: mapped.wcId },
        update: {
          name: mapped.name,
          design: mapped.design,
          unitPrice: mapped.unitPrice,
          isActive: true,
        },
        create: {
          wcId: mapped.wcId,
          sku: mapped.sku,
          name: mapped.name,
          categoryId: category.id,
          design: mapped.design,
          unitPrice: mapped.unitPrice,
          isActive: true,
        },
      });

      if (existing) updated++;
      else created++;
    }

    return { processed: products.length, created, updated };
  }
}

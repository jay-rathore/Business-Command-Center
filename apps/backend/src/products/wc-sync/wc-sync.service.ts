import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IntegrationProvider } from "@prisma/client";
import { PRISMA_EXTENDED_CLIENT } from "../../prisma/prisma-extended.provider";
import type { ExtendedPrismaClient } from "../../prisma/prisma-extended.provider";
import { TenantContext } from "../../common/context/tenant-context";
import { IntegrationConnectionsService } from "../../integration-connections/integration-connections.service";
import type { WooCommerceCredentials } from "../../integration-connections/credential-types";
import { mapWcProduct, WcProductRaw } from "./wc-product-mapper";

const EXTERIOR_CLADDING_CATEGORY = "Exterior Cladding";

export interface WcSyncResult {
  processed: number;
  created: number;
  updated: number;
}

/** Pulls the real product catalog from each tenant's own live WooCommerce store (credentials:
 * IntegrationConnection, provider WOOCOMMERCE) and upserts it by wcId, additively, alongside
 * that tenant's fabricated seed.ts catalog — never deletes, mirrors CrmSyncService's
 * (../../leads/crm-sync/crm-sync.service.ts) approach for the same reason: existing Order/
 * Complaint/WarrantyClaim rows already reference fabricated Product rows and must not be
 * orphaned. */
@Injectable()
export class WcSyncService {
  private readonly logger = new Logger(WcSyncService.name);

  constructor(
    @Inject(PRISMA_EXTENDED_CLIENT) private readonly prisma: ExtendedPrismaClient,
    private readonly connections: IntegrationConnectionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledSync(): Promise<void> {
    const active = await this.connections.listActive(IntegrationProvider.WOOCOMMERCE);
    for (const connection of active) {
      await TenantContext.run({ organizationId: connection.organizationId }, async () => {
        try {
          const credentials = this.connections.decrypt<WooCommerceCredentials>(connection);
          const result = await this.syncNow(credentials);
          await this.connections.recordSuccess(connection.id);
          this.logger.log(
            `WooCommerce sync (org ${connection.organizationId}): ${result.processed} products processed (${result.created} new, ${result.updated} updated)`,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await this.connections.recordError(connection.id, message);
          this.logger.error(`WooCommerce sync failed (org ${connection.organizationId}): ${message}`);
        }
      });
    }
  }

  async syncNow(credentials: WooCommerceCredentials): Promise<WcSyncResult> {
    const auth = Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString("base64");

    const organizationId = TenantContext.get().organizationId;
    const category = await this.prisma.productCategory.findUniqueOrThrow({
      where: { organizationId_name: { organizationId, name: EXTERIOR_CLADDING_CATEGORY } },
    });

    const res = await fetch(`${credentials.url}/wp-json/wc/v3/products?per_page=100&status=publish`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error(`WooCommerce API returned ${res.status}`);
    const products = (await res.json()) as WcProductRaw[];

    let created = 0;
    let updated = 0;

    for (const raw of products) {
      const mapped = mapWcProduct(raw);
      const existing = await this.prisma.product.findUnique({
        where: { organizationId_wcId: { organizationId, wcId: mapped.wcId } },
        select: { id: true },
      });

      await this.prisma.product.upsert({
        where: { organizationId_wcId: { organizationId, wcId: mapped.wcId } },
        update: {
          name: mapped.name,
          design: mapped.design,
          unitPrice: mapped.unitPrice,
          isActive: true,
        },
        create: {
          organizationId,
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

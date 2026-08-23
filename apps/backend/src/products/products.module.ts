import { Module } from "@nestjs/common";
import { IntegrationConnectionsModule } from "../integration-connections/integration-connections.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { WcSyncController } from "./wc-sync/wc-sync.controller";
import { WcSyncService } from "./wc-sync/wc-sync.service";

@Module({
  imports: [IntegrationConnectionsModule],
  controllers: [ProductsController, WcSyncController],
  providers: [ProductsService, WcSyncService],
})
export class ProductsModule {}

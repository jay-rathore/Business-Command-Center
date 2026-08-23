import { Module } from "@nestjs/common";
import { IntegrationConnectionsController } from "./integration-connections.controller";
import { IntegrationConnectionsService } from "./integration-connections.service";

@Module({
  controllers: [IntegrationConnectionsController],
  providers: [IntegrationConnectionsService],
  exports: [IntegrationConnectionsService],
})
export class IntegrationConnectionsModule {}

import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { SalesTargetsController } from "./sales-targets.controller";
import { SalesTargetsService } from "./sales-targets.service";

@Module({
  controllers: [SalesController, SalesTargetsController],
  providers: [SalesService, SalesTargetsService],
  exports: [SalesService],
})
export class SalesModule {}

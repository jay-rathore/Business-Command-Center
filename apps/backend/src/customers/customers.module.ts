import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { CustomerMetricsService } from "./customer-metrics.service";

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomerMetricsService],
  exports: [CustomersService],
})
export class CustomersModule {}

import { Module } from "@nestjs/common";
import { DealersController } from "./dealers.controller";
import { DealersService } from "./dealers.service";
import { DealerScoringService } from "./dealer-scoring.service";

@Module({
  controllers: [DealersController],
  providers: [DealersService, DealerScoringService],
  exports: [DealersService],
})
export class DealersModule {}

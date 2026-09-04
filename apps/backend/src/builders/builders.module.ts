import { Module } from "@nestjs/common";
import { BuildersController } from "./builders.controller";
import { BuildersService } from "./builders.service";

@Module({
  controllers: [BuildersController],
  providers: [BuildersService],
})
export class BuildersModule {}

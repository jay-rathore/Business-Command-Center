import { Module } from "@nestjs/common";
import { SalesTeamController } from "./sales-team.controller";
import { SalesTeamService } from "./sales-team.service";

@Module({
  controllers: [SalesTeamController],
  providers: [SalesTeamService],
})
export class SalesTeamModule {}

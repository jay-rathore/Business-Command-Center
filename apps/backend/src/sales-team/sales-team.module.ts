import { Module } from "@nestjs/common";
import { SalesTeamController } from "./sales-team.controller";
import { LeadsModule } from "../leads/leads.module";
import { SalesTeamService } from "./sales-team.service";
import { ExecutiveDetailService } from "./executive-detail.service";

@Module({
  imports: [LeadsModule],
  controllers: [SalesTeamController],
  providers: [SalesTeamService, ExecutiveDetailService],
})
export class SalesTeamModule {}

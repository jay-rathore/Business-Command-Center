import { Controller, Get, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
import { SalesTeamListQueryDto } from "./dto/sales-team-list-query.dto";
import { SalesTeamService } from "./sales-team.service";

@Controller("sales-team")
@RequirePermission("sales_team:read")
export class SalesTeamController {
  constructor(private readonly salesTeamService: SalesTeamService) {}

  @Get()
  findAll(@Query() query: SalesTeamListQueryDto) {
    return this.salesTeamService.findAll(query);
  }

  @Get("kpis")
  getKpis(@Query() query: DateRangeQueryDto) {
    return this.salesTeamService.getKpis(query.dateFrom, query.dateTo);
  }

  @Get("leaderboard")
  getLeaderboard(@Query() query: DateRangeQueryDto) {
    return this.salesTeamService.getLeaderboard(query.dateFrom, query.dateTo);
  }

  @Get("follow-up-risk")
  getFollowUpRisk() {
    return this.salesTeamService.getFollowUpRisk();
  }
}

import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
import { DealersListQueryDto } from "./dto/dealers-list-query.dto";
import { DealersService } from "./dealers.service";

@Controller("dealers")
@RequirePermission("dealers:read")
export class DealersController {
  constructor(private readonly dealersService: DealersService) {}

  @Get()
  findAll(@Query() query: DealersListQueryDto) {
    return this.dealersService.findAll(query);
  }

  @Get("kpis")
  getKpis(@Query() query: DateRangeQueryDto) {
    return this.dealersService.getKpis(query.dateFrom, query.dateTo);
  }

  @Get("leaderboard")
  getLeaderboard(@Query() query: DateRangeQueryDto) {
    return this.dealersService.getLeaderboard(query.dateFrom, query.dateTo);
  }

  @Get("risk-alerts")
  getRiskAlerts(@Query() query: DateRangeQueryDto) {
    return this.dealersService.getRiskAlerts(query.dateFrom, query.dateTo);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.dealersService.findOne(id);
  }

  @Post(":id/recompute-score")
  recomputeScore(@Param("id") id: string) {
    return this.dealersService.recomputeScore(id);
  }
}

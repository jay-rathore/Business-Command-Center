import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
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
  getKpis() {
    return this.dealersService.getKpis();
  }

  @Get("leaderboard")
  getLeaderboard() {
    return this.dealersService.getLeaderboard();
  }

  @Get("risk-alerts")
  getRiskAlerts() {
    return this.dealersService.getRiskAlerts();
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

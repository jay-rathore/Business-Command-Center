import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CustomersListQueryDto } from "./dto/customers-list-query.dto";
import { CustomersService } from "./customers.service";

@Controller("customers")
@RequirePermission("customers:read")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Query() query: CustomersListQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get("kpis")
  getKpis() {
    return this.customersService.getKpis();
  }

  @Get("leaderboard")
  getLeaderboard() {
    return this.customersService.getLeaderboard();
  }

  @Get("at-risk")
  getAtRisk() {
    return this.customersService.getAtRisk();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }

  @Post(":id/recompute-metrics")
  recomputeMetrics(@Param("id") id: string) {
    return this.customersService.recomputeMetrics(id);
  }
}

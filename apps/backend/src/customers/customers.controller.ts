import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
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
  getKpis(@Query() query: DateRangeQueryDto) {
    return this.customersService.getKpis(query.dateFrom, query.dateTo);
  }

  @Get("leaderboard")
  getLeaderboard(@Query() query: DateRangeQueryDto) {
    return this.customersService.getLeaderboard(query.dateFrom, query.dateTo);
  }

  @Get("at-risk")
  getAtRisk(@Query() query: DateRangeQueryDto) {
    return this.customersService.getAtRisk(query.dateFrom, query.dateTo);
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

import { Controller, Get, Param, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
import { BuildersListQueryDto } from "./dto/builders-list-query.dto";
import { BuildersService } from "./builders.service";

@Controller("builders")
@RequirePermission("builders:read")
export class BuildersController {
  constructor(private readonly buildersService: BuildersService) {}

  @Get()
  findAll(@Query() query: BuildersListQueryDto) {
    return this.buildersService.findAll(query);
  }

  @Get("kpis")
  getKpis(@Query() query: DateRangeQueryDto) {
    return this.buildersService.getKpis(query.dateFrom, query.dateTo);
  }

  @Get("leaderboard")
  getLeaderboard(@Query() query: DateRangeQueryDto) {
    return this.buildersService.getLeaderboard(query.dateFrom, query.dateTo);
  }

  @Get("recent-referrals")
  getRecentReferrals() {
    return this.buildersService.getRecentReferrals();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.buildersService.findOne(id);
  }
}

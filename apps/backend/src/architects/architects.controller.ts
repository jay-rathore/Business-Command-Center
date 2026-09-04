import { Controller, Get, Param, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
import { ArchitectsListQueryDto } from "./dto/architects-list-query.dto";
import { ArchitectsService } from "./architects.service";

@Controller("architects")
@RequirePermission("architects:read")
export class ArchitectsController {
  constructor(private readonly architectsService: ArchitectsService) {}

  @Get()
  findAll(@Query() query: ArchitectsListQueryDto) {
    return this.architectsService.findAll(query);
  }

  @Get("kpis")
  getKpis(@Query() query: DateRangeQueryDto) {
    return this.architectsService.getKpis(query.dateFrom, query.dateTo);
  }

  @Get("leaderboard")
  getLeaderboard(@Query() query: DateRangeQueryDto) {
    return this.architectsService.getLeaderboard(query.dateFrom, query.dateTo);
  }

  @Get("recent-referrals")
  getRecentReferrals() {
    return this.architectsService.getRecentReferrals();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.architectsService.findOne(id);
  }
}

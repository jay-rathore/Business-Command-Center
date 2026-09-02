import { Controller, Get, Param, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
import { MarketingListQueryDto } from "./dto/marketing-list-query.dto";
import { MarketingService } from "./marketing.service";

@Controller("marketing")
@RequirePermission("marketing:read")
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get()
  findAll(@Query() query: MarketingListQueryDto) {
    return this.marketingService.findAll(query);
  }

  @Get("kpis")
  getKpis(@Query() query: DateRangeQueryDto) {
    return this.marketingService.getKpis(query.dateFrom, query.dateTo);
  }

  @Get("channel-breakdown")
  getChannelBreakdown(@Query() query: DateRangeQueryDto) {
    return this.marketingService.getChannelBreakdown(query.dateFrom, query.dateTo);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.marketingService.findOne(id);
  }
}

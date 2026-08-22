import { Controller, Get, Param, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
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
  getKpis() {
    return this.marketingService.getKpis();
  }

  @Get("channel-breakdown")
  getChannelBreakdown() {
    return this.marketingService.getChannelBreakdown();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.marketingService.findOne(id);
  }
}

import { Controller, Get, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { BreakdownQueryDto, SalesTableQueryDto, TrendQueryDto } from "./dto/sales-query.dto";
import { SalesService } from "./sales.service";

@Controller("sales")
@RequirePermission("sales:read")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get("overview")
  getOverview() {
    return this.salesService.getOverview();
  }

  @Get("revenue-trend")
  getRevenueTrend(@Query() query: TrendQueryDto) {
    return this.salesService.getRevenueTrend(query.granularity);
  }

  @Get("breakdown")
  getBreakdown(@Query() query: BreakdownQueryDto) {
    return this.salesService.getBreakdown(query.by);
  }

  @Get("table")
  getProductTable(@Query() query: SalesTableQueryDto) {
    return this.salesService.getProductTable(query);
  }
}

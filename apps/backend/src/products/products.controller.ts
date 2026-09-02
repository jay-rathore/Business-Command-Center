import { Controller, Get, Param, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
import { ProductsListQueryDto } from "./dto/products-list-query.dto";
import { ProductsService } from "./products.service";

@Controller("products")
@RequirePermission("products:read")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findCatalog(@Query() query: ProductsListQueryDto) {
    return this.productsService.findCatalog(query);
  }

  @Get("categories")
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get("shades")
  getShades() {
    return this.productsService.getShades();
  }

  @Get("stats/summary")
  getStatSummary(@Query() query: DateRangeQueryDto) {
    return this.productsService.getStatSummary(query.dateFrom, query.dateTo);
  }

  @Get("stats/by-category")
  getCategoryBreakdown(@Query() query: DateRangeQueryDto) {
    return this.productsService.getCategoryBreakdown(query.dateFrom, query.dateTo);
  }

  @Get("stats/needs-attention")
  getNeedsAttention(@Query() query: DateRangeQueryDto) {
    return this.productsService.getNeedsAttention(query.dateFrom, query.dateTo);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }
}

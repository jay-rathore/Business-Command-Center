import { Controller, Get, Param, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
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
  getStatSummary() {
    return this.productsService.getStatSummary();
  }

  @Get("stats/by-category")
  getCategoryBreakdown() {
    return this.productsService.getCategoryBreakdown();
  }

  @Get("stats/needs-attention")
  getNeedsAttention() {
    return this.productsService.getNeedsAttention();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }
}

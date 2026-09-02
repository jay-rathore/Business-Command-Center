import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { SalesTargetsListQueryDto } from "./dto/sales-targets-list-query.dto";
import { UpsertSalesTargetDto } from "./dto/upsert-sales-target.dto";
import { SalesTargetsService } from "./sales-targets.service";

@Controller("sales-targets")
@RequirePermission("settings:read")
export class SalesTargetsController {
  constructor(private readonly salesTargets: SalesTargetsService) {}

  @Get()
  findAll(@Query() query: SalesTargetsListQueryDto) {
    return this.salesTargets.findAll(query);
  }

  @Post()
  @RequirePermission("settings:write")
  create(@Body() dto: UpsertSalesTargetDto) {
    return this.salesTargets.create(dto);
  }

  @Patch(":id")
  @RequirePermission("settings:write")
  update(@Param("id") id: string, @Body() dto: UpsertSalesTargetDto) {
    return this.salesTargets.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("settings:write")
  remove(@Param("id") id: string) {
    return this.salesTargets.remove(id);
  }
}

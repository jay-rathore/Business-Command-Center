import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { LeadsListQueryDto } from "./dto/leads-list-query.dto";
import { CreateLeadActivityDto } from "./dto/create-activity.dto";
import { LeadsService } from "./leads.service";

@Controller("leads")
@RequirePermission("leads:read")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Query() query: LeadsListQueryDto) {
    return this.leadsService.findAll(query);
  }

  @Get("kpis")
  getKpis() {
    return this.leadsService.getKpis();
  }

  @Get("funnel")
  getFunnel() {
    return this.leadsService.getFunnel();
  }

  @Get("sources")
  getSourceBreakdown() {
    return this.leadsService.getSourceBreakdown();
  }

  @Get("statuses")
  getStatusOptions() {
    return this.leadsService.getStatusOptions();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.leadsService.findOne(id);
  }

  @Post(":id/activities")
  @RequirePermission("leads:write")
  addActivity(@Param("id") id: string, @Body() dto: CreateLeadActivityDto) {
    return this.leadsService.addActivity(id, dto);
  }
}

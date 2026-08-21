import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { LeadsListQueryDto } from "./dto/leads-list-query.dto";
import { CreateLeadActivityDto } from "./dto/create-activity.dto";
import { ScanBusinessCardDto } from "./dto/scan-business-card.dto";
import { CreateLeadFromCardDto } from "./dto/create-lead-from-card.dto";
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

  @Get("types")
  getLeadTypeOptions() {
    return this.leadsService.getLeadTypeOptions();
  }

  @Get("executives")
  getExecutiveOptions() {
    return this.leadsService.getExecutiveOptions();
  }

  @Get("duplicates")
  checkDuplicates(@Query("phone") phone: string, @Query("email") email?: string) {
    return this.leadsService.checkDuplicates(phone, email ?? null);
  }

  // Vision-AI extraction only — costs money per call and never touches the database, so it's
  // gated behind leads:write like any other resource-consuming mutation.
  @Post("business-card/scan")
  @RequirePermission("leads:write")
  scanBusinessCard(@Body() dto: ScanBusinessCardDto) {
    return this.leadsService.scanBusinessCard(dto);
  }

  @Post()
  @RequirePermission("leads:write")
  create(@Body() dto: CreateLeadFromCardDto) {
    return this.leadsService.createFromBusinessCard(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.leadsService.findOne(id);
  }

  @Get(":id/business-card-image")
  async getBusinessCardImage(@Param("id") id: string, @Res() res: Response) {
    const path = await this.leadsService.getBusinessCardImagePath(id);
    res.sendFile(path);
  }

  @Post(":id/activities")
  @RequirePermission("leads:write")
  addActivity(@Param("id") id: string, @Body() dto: CreateLeadActivityDto) {
    return this.leadsService.addActivity(id, dto);
  }
}

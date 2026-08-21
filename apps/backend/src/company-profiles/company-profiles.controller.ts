import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CompanyProfilesService } from "./company-profiles.service";
import { UpsertCompanyProfileDto } from "./dto/upsert-company-profile.dto";

@Controller("company-profiles")
@RequirePermission("settings:read")
export class CompanyProfilesController {
  constructor(private readonly companyProfiles: CompanyProfilesService) {}

  @Get()
  findAll() {
    return this.companyProfiles.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.companyProfiles.findOne(id);
  }

  @Post()
  @RequirePermission("settings:write")
  create(@Body() dto: UpsertCompanyProfileDto) {
    return this.companyProfiles.create(dto);
  }

  @Patch(":id")
  @RequirePermission("settings:write")
  update(@Param("id") id: string, @Body() dto: UpsertCompanyProfileDto) {
    return this.companyProfiles.update(id, dto);
  }
}

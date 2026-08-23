import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean } from "class-validator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminService } from "./platform-admin.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { ResetAdminPasswordDto } from "./dto/reset-admin-password.dto";

class SetActiveDto {
  @IsBoolean()
  isActive: boolean;
}

@Controller("platform-admin/organizations")
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get()
  findAll() {
    return this.platformAdmin.listOrganizations();
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.platformAdmin.createOrganization(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrganizationDto) {
    return this.platformAdmin.updateOrganization(id, dto);
  }

  @Patch(":id/active")
  setActive(
    @Param("id") id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser("organizationId") callerOrganizationId: string,
  ) {
    return this.platformAdmin.setOrganizationActive(id, dto.isActive, callerOrganizationId);
  }

  @Post(":id/reset-admin-password")
  resetAdminPassword(
    @Param("id") id: string,
    @Body() dto: ResetAdminPasswordDto,
    @CurrentUser("organizationId") callerOrganizationId: string,
  ) {
    return this.platformAdmin.resetAdminPassword(id, dto, callerOrganizationId);
  }
}

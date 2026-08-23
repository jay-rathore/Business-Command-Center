import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IntegrationProvider } from "@prisma/client";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { IntegrationConnectionsService } from "./integration-connections.service";
import { UpsertConnectionDto } from "./dto/upsert-connection.dto";

@Controller("integration-connections")
@RequirePermission("settings:read")
export class IntegrationConnectionsController {
  constructor(private readonly connections: IntegrationConnectionsService) {}

  @Get()
  findAll(@CurrentUser("organizationId") organizationId: string) {
    return this.connections.listForOrg(organizationId);
  }

  @Post()
  @RequirePermission("settings:write")
  upsert(@CurrentUser("organizationId") organizationId: string, @Body() dto: UpsertConnectionDto) {
    return this.connections.upsert(organizationId, dto.provider, dto.credentials, dto.isActive ?? true);
  }

  @Post(":provider/deactivate")
  @RequirePermission("settings:write")
  deactivate(@CurrentUser("organizationId") organizationId: string, @Param("provider") provider: IntegrationProvider) {
    return this.connections.setActive(organizationId, provider, false);
  }

  @Post(":provider/activate")
  @RequirePermission("settings:write")
  activate(@CurrentUser("organizationId") organizationId: string, @Param("provider") provider: IntegrationProvider) {
    return this.connections.setActive(organizationId, provider, true);
  }
}

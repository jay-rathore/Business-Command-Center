import { Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { CurrentUserData } from "../common/types/jwt-payload.interface";
import { NotificationsListQueryDto } from "./dto/notifications-list-query.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@RequirePermission("notifications:read")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Query() query: NotificationsListQueryDto, @CurrentUser() user: CurrentUserData) {
    return this.notificationsService.findAll(user, query);
  }

  @Get("unread-count")
  getUnreadCount(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch(":id/read")
  @RequirePermission("notifications:write")
  markRead(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markRead(id, user);
  }

  @Post("read-all")
  @RequirePermission("notifications:write")
  markAllRead(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markAllRead(user);
  }
}

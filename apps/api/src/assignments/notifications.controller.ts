import { Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "My notifications" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Unread notification count" })
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a notification read" })
  read(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(id, user);
  }

  @Post("read-all")
  @ApiOperation({ summary: "Mark all notifications read" })
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user);
  }
}

import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, requireUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { NotificationsService } from "./notifications.service";

/**
 * Notification centre (Prompt.md §13): list + mark-all-read. Everything here
 * is scoped to the caller - there is no route that can read another
 * account's notifications.
 */
@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.notifications.list(requireUser(user).id);
  }

  @Post("read")
  markAllRead(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.notifications.markAllRead(requireUser(user).id);
  }
}

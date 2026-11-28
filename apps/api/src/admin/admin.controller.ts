import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";

import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import {
  CurrentUser,
  requireUser,
} from "../common/decorators/current-user.decorator";
import { AdminOnly } from "../common/decorators/admin-only.decorator";
import { RejectListingDto } from "./admin.dto";
import { AdminService } from "./admin.service";

/**
 * The admin surface (Stage B: listing review).
 *
 * Every route is double-gated and the order is deliberate: JwtAuthGuard runs
 * first and resolves the caller (including the live role read from the
 * database), then AdminGuard refuses anyone who is not ADMIN. The decorator is
 * what AdminGuard looks for, so a route that forgets @AdminOnly() simply isn't
 * protected rather than being silently open - and these routes are all
 * protected at the controller level.
 */
@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
@AdminOnly()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Listings waiting on a decision, plus previously rejected ones. */
  @Get("moderation/queue")
  queue() {
    return this.admin.moderationQueue();
  }

  @Patch("moderation/:id/approve")
  approve(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.admin.approve(id, requireUser(user).id);
  }

  @Patch("moderation/:id/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectListingDto,
  ) {
    return this.admin.reject(id, requireUser(user).id, dto.reason);
  }
}

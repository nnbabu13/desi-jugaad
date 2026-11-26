import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, requireUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { HostService } from "./host.service";

/**
 * Host-side analytics. Always computed from the caller's own listings and
 * conversations - there is no way to pass another host's id.
 */
@Controller("host")
@UseGuards(JwtAuthGuard)
export class HostController {
  constructor(private readonly host: HostService) {}

  @Get("stats")
  stats(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.host.getStats(requireUser(user).id);
  }
}

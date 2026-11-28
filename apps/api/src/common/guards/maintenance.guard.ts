import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";

import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";
import { SettingsService } from "../../settings/settings.service";

/**
 * Blocks member listing writes while the platform is in maintenance.
 *
 * Deliberately a guard on the write routes rather than a global one: reads
 * stay open so visitors can still browse, and an admin can still get in to
 * turn the switch off - which is the whole point of a maintenance mode that
 * nobody can undo.
 *
 * Guard order matters: JwtAuthGuard must run first, otherwise `user` is
 * undefined and every request would look anonymous.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly settings: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    // Admins bypass so the switch can always be turned back off.
    if (request.user?.role === "ADMIN") return true;
    if (!(await this.settings.isMaintenanceMode())) return true;

    throw new ServiceUnavailableException(
      "Listings are temporarily frozen for maintenance. Browsing still works.",
    );
  }
}

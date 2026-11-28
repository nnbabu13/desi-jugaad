import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { ADMIN_ONLY_KEY } from "../../common/decorators/admin-only.decorator";
import type { AuthenticatedUser } from "../strategies/jwt.strategy";

/**
 * Gates handlers marked with `@AdminOnly()` on the ADMIN role.
 *
 * Two tiers only (USER / ADMIN), and the check is entirely server-side: the
 * client hiding a button proves nothing, so every admin route declares itself
 * here. The role is the live column read by JwtStrategy - never a token claim
 * - which is what makes suspension and demotion take effect immediately.
 *
 * 401 when there is no caller, 403 when the caller simply is not an admin,
 * so the two failure modes stay distinguishable for clients.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("Sign in to continue.");
    }
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Admin access required.");
    }
    return true;
  }
}

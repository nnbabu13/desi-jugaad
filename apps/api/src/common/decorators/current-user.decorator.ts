import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";

/**
 * `@CurrentUser()` handler parameter decorator.
 *
 * Usage:
 *   @Get('me')
 *   me(@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (
    key: keyof AuthenticatedUser | undefined,
    context: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] | undefined => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return undefined;
    return key ? user[key] : user;
  },
);

/** Narrow helper so handlers can assert a user is present after the guard. */
export function requireUser(
  user: AuthenticatedUser | undefined,
): AuthenticatedUser {
  if (!user) {
    throw new Error("Authenticated route reached without a user on the request.");
  }
  return user;
}

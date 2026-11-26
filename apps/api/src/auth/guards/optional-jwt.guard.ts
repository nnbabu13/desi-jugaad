import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

/**
 * Attaches `request.user` when a valid token is present, but never rejects an
 * anonymous request. Used by endpoints that personalise for signed-in users
 * (e.g. the Home feed) while staying publicly browsable.
 *
 * A token that *was* presented but is expired or forged still fails loudly, so
 * a stale session surfaces as "please refresh" instead of silently degrading
 * to anonymous content.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | null,
    _info: unknown,
    context: { switchToHttp: () => { getRequest: () => Request } },
  ): TUser | null {
    const request = context.switchToHttp().getRequest();
    const presented = Boolean(request.headers.authorization);

    if (presented && (err || !user)) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException("Session expired. Please sign in again.");
    }

    return user ?? null;
  }
}

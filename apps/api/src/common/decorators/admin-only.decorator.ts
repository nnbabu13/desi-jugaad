import { SetMetadata } from "@nestjs/common";

export const ADMIN_ONLY_KEY = "adminOnly";

/**
 * `@AdminOnly()` - marks a handler (or a whole controller) as admin-only.
 *
 * The companion `AdminGuard` reads the caller's role from the database on
 * every request (JwtStrategy reloads the row), so demoting an account cuts off
 * access on its very next request instead of when the access token expires.
 *
 * Usage:
 *   @Get('stats')
 *   @UseGuards(JwtAuthGuard, AdminGuard)
 *   @AdminOnly()
 *   stats() { ... }
 *
 * JwtAuthGuard must be listed first so `request.user` exists before this
 * guard evaluates it.
 */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

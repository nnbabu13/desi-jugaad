import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
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
import {
  AdminListingStatusDto,
  AdminUserDto,
  RejectListingDto,
  ToggleLocationDto,
  UpdateSettingDto,
} from "./admin.dto";
import { LISTING_STATUS_VALUES, AdminService } from "./admin.service";

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

  /* --------------------------------------------------------------- stats */

  @Get("stats")
  stats() {
    return this.admin.stats();
  }

  /* ----------------------------------------------------------- locations */

  /** All countries, plus one country's cities (`?country=` id or ISO code). */
  @Get("locations")
  locations(@Query("country") country?: string) {
    return this.admin.locations(country?.trim() || undefined);
  }

  @Patch("locations/countries/:id")
  setCountry(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ToggleLocationDto,
  ) {
    return this.admin.setCountryActive(id, dto.isActive);
  }

  @Patch("locations/cities/:id")
  setCity(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ToggleLocationDto,
  ) {
    return this.admin.setCityActive(id, dto.isActive);
  }

  /* ------------------------------------------------------------ listings */

  /** The whole roster in any status - unlike the public feed, not just ACTIVE. */
  @Get("listings")
  listings(
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("take") take?: string,
  ) {
    const wanted = status?.trim();
    const valid = wanted
      ? LISTING_STATUS_VALUES.includes(wanted as never)
        ? (wanted as (typeof LISTING_STATUS_VALUES)[number])
        : undefined
      : undefined;
    if (wanted && !valid) {
      throw new BadRequestException(
        `Unknown status "${wanted}". Valid: ${LISTING_STATUS_VALUES.join(", ")}.`,
      );
    }
    return this.admin.listings({
      status: valid,
      q: q?.trim() || undefined,
      take: toInt(take),
    });
  }

  @Patch("listings/:id")
  setListing(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminListingStatusDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    const actor = requireUser(user);
    // ACTIVE is the only status that can mean two different things: approving
    // a listing that is waiting on review (record the verdict), or simply
    // un-pausing one that was already live (no verdict to record).
    if (dto.status === "ACTIVE") {
      return this.admin.activateListing(id, actor.id);
    }
    return this.admin.setListingStatus(id, dto.status);
  }

  /* ---------------------------------------------------------------- users */

  @Get("users")
  users(
    @Query("status") status?: string,
    @Query("role") role?: string,
    @Query("q") q?: string,
    @Query("take") take?: string,
  ) {
    return this.admin.users({
      status: status?.trim() || undefined,
      role: role?.trim() || undefined,
      q: q?.trim() || undefined,
      take: toInt(take),
    });
  }

  @Patch("users/:id")
  updateUser(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminUserDto,
  ) {
    const actor = requireUser(user);
    return this.admin.updateUser(id, dto, { id: actor.id, role: actor.role });
  }

  /* ------------------------------------------------------------- settings */

  @Get("settings")
  settings() {
    return this.admin.getSettings();
  }

  @Patch("settings")
  updateSetting(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.admin.updateSetting(dto.key, dto.value, requireUser(user).id);
  }
}

/** Query strings arrive as text; blank means "not specified". */
function toInt(value?: string): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

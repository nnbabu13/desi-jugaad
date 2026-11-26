import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { BlockUserDto, UpdateProfileDto } from "./users.dto";
import { UsersService } from "./users.service";

/**
 * Profile endpoints (Ui Plan, Part D).
 *
 * `/users/me` (and its `me/blocks` children) are declared before `/users/:id`
 * so "me" is never parsed as a UUID. The public profile route uses the
 * optional guard: anonymous callers get the restricted view, signed-in
 * callers get whatever the visibility setting allows.
 */
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getProfile(user.id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.id, dto);
  }

  /** Permanently removes the caller's own account (Settings). */
  @Delete("me")
  @UseGuards(JwtAuthGuard)
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.deleteAccount(user.id);
  }

  @Get("me/blocks")
  @UseGuards(JwtAuthGuard)
  listBlocks(@CurrentUser() user: AuthenticatedUser) {
    return this.users.listBlocks(user.id);
  }

  @Post("me/blocks")
  @UseGuards(JwtAuthGuard)
  block(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BlockUserDto,
  ) {
    return this.users.block(user.id, dto);
  }

  @Delete("me/blocks/:userId")
  @UseGuards(JwtAuthGuard)
  unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.users.unblock(user.id, userId);
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  publicProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.users.getPublicProfile(id, viewer?.id);
  }
}

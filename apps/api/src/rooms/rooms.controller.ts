import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  requireUser,
} from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import {
  CreateRoomDto,
  ListRoomsDto,
  UpdateRoomDto,
} from "./rooms.dto";
import { RoomsService } from "./rooms.service";

/**
 * Marketplace listing endpoints (Prompt.md §5, §12).
 *
 * The feed is intentionally public: browsing listings must work signed out,
 * and only ACTIVE listings ever leave the public routes. Publishing, the
 * owner's own list, edits and deletes require a session and are always
 * scoped to the caller's own rows.
 */
@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Query() dto: ListRoomsDto) {
    return this.rooms.list(dto);
  }

  // Declared before `:id` so "mine" can never be parsed as a UUID param.
  @Get("mine")
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.rooms.mine(requireUser(user).id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateRoomDto,
  ) {
    return this.rooms.create(requireUser(user).id, dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.rooms.update(id, requireUser(user).id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.rooms.remove(id, requireUser(user).id);
  }

  // Kept last so a UUID is always what the pipe receives.
  @Get(":id")
  one(@Param("id", ParseUUIDPipe) id: string) {
    return this.rooms.getOne(id);
  }
}

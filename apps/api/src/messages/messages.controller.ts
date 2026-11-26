import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, requireUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { CreateConversationDto, SendMessageDto } from "./messages.dto";
import { MessagesService } from "./messages.service";

/**
 * Direct messaging (Prompt.md §13). Every route requires a session and is
 * scoped to threads the caller actually participates in.
 *
 * Route order matters: `conversations` is declared before `:id` so it is
 * never parsed as a UUID.
 */
@Controller("messages")
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("conversations")
  listConversations(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.messages.listConversations(requireUser(user).id);
  }

  @Post("conversations")
  createConversation(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messages.createConversation(requireUser(user).id, dto.roomId);
  }

  @Get(":id")
  listMessages(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.messages.listMessages(requireUser(user).id, id);
  }

  @Post(":id")
  sendMessage(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.sendMessage(requireUser(user).id, id, dto.body);
  }
}

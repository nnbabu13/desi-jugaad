import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const CONVERSATION_INCLUDE = {
  participantAUser: {
    select: {
      id: true,
      profile: { select: { fullName: true, avatarUrl: true } },
    },
  },
  participantBUser: {
    select: {
      id: true,
      profile: { select: { fullName: true, avatarUrl: true } },
    },
  },
  room: { select: { id: true, hostId: true, title: true } },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_INCLUDE;
}>;

const PREVIEW_MAX = 500;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The caller's inbox, most recently active thread first. */
  async listConversations(userId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ participantA: userId }, { participantB: userId }] },
      // `updatedAt` is bumped on every send, so it doubles as recency even
      // for threads that have never had a message (`lastMessageAt` null).
      orderBy: { updatedAt: "desc" },
      include: {
        ...CONVERSATION_INCLUDE,
        messages: {
          where: { senderId: { not: userId }, readAt: null },
          select: { id: true },
        },
      },
    });

    return rows.map((row) => this.presentConversation(userId, row));
  }

  /**
   * Messages in one thread, plus who the thread is with (the header needs the
   * real name, and "Block" needs the other member's id). Reading marks the
   * caller's incoming messages as read, which clears the inbox unread badge.
   */
  async listMessages(userId: string, conversationId: string) {
    const conversation = await this.assertParticipant(userId, conversationId);

    const otherId =
      conversation.participantA === userId
        ? conversation.participantB
        : conversation.participantA;

    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

    const [messages, other] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, createdAt: true, senderId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: otherId },
        select: { profile: { select: { fullName: true, avatarUrl: true } } },
      }),
    ]);

    return {
      otherUserId: otherId,
      otherUserName: other?.profile?.fullName ?? "Member",
      otherUserAvatar: other?.profile?.avatarUrl ?? null,
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        senderId: m.senderId,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async sendMessage(userId: string, conversationId: string, body: string) {
    const conversation = await this.assertParticipant(userId, conversationId);

    const otherId =
      conversation.participantA === userId
        ? conversation.participantB
        : conversation.participantA;

    // A block in either direction stops the thread immediately.
    await this.assertNotBlocked(userId, otherId);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, body },
      select: { id: true, body: true, createdAt: true, senderId: true },
    });

    // Keep the inbox preview and ordering in step with the new message.
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: body.slice(0, PREVIEW_MAX),
      },
    });

    // The preview text itself stays out of the notification body: lock-screen
    // notifications must not leak message content (Prompt.md 13).
    const senderName = await this.fullName(userId);
    await this.notifications.create({
      userId: otherId,
      type: "message",
      title: `${senderName} sent you a message`,
      body: "Open the conversation to read and reply.",
      referenceType: "conversation",
      referenceId: conversationId,
    });

    return {
      id: message.id,
      body: message.body,
      senderId: message.senderId,
      createdAt: message.createdAt.toISOString(),
    };
  }

  /**
   * Opens the thread for a listing and reuses it when one already exists.
   * Participants are stored ordered (A < B), which is what makes the unique
   * pair constraint able to prevent duplicate threads.
   */
  async createConversation(userId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, status: "ACTIVE" },
      select: { id: true, hostId: true },
    });
    if (!room) {
      throw new NotFoundException("Room not found.");
    }
    if (room.hostId === userId) {
      throw new BadRequestException("You already own this listing.");
    }

    // A block in either direction prevents a new thread from starting.
    await this.assertNotBlocked(userId, room.hostId);

    const [a, b] =
      userId < room.hostId ? [userId, room.hostId] : [room.hostId, userId];

    let conversation = await this.prisma.conversation.findUnique({
      where: { participantA_participantB: { participantA: a, participantB: b } },
      include: CONVERSATION_INCLUDE,
    });

    if (!conversation) {
      try {
        conversation = await this.prisma.conversation.create({
          data: { participantA: a, participantB: b, roomId: room.id },
          include: CONVERSATION_INCLUDE,
        });
      } catch {
        // Two requests raced on the unique pair - the winner's row is fine.
        conversation = await this.prisma.conversation.findUniqueOrThrow({
          where: {
            participantA_participantB: { participantA: a, participantB: b },
          },
          include: CONVERSATION_INCLUDE,
        });
      }
    }

    return this.presentConversation(userId, conversation);
  }

  /* ------------------------------------------------------------------ */

  /**
   * A block in either direction ends messaging between the pair: starting a
   * thread and sending into an existing one both go through here.
   */
  private async assertNotBlocked(a: string, b: string): Promise<void> {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });

    if (block) {
      throw new ForbiddenException(
        "You can no longer message this person.",
      );
    }
  }

  /** Loads the thread and 404s when the caller is not a participant. */
  private async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { participantA: true, participantB: true },
    });

    if (
      !conversation ||
      (conversation.participantA !== userId &&
        conversation.participantB !== userId)
    ) {
      // Same response for "does not exist" and "not yours": no existence leak.
      throw new NotFoundException("Conversation not found.");
    }

    return conversation;
  }

  private async fullName(userId: string): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { fullName: true },
    });
    return profile?.fullName ?? "Someone";
  }

  private presentConversation(
    viewerId: string,
    row: ConversationRow & { messages?: { id: string }[] },
  ) {
    const viewerIsA = row.participantA === viewerId;
    const other = viewerIsA ? row.participantBUser : row.participantAUser;
    const otherName = other.profile?.fullName ?? "Member";
    const otherAvatar = other.profile?.avatarUrl ?? null;

    // `hostName` is only populated when the other participant actually hosts
    // the linked listing, so an investor's own inbox shows guests by name
    // instead of labelling them as hosts.
    const otherIsHost = row.room !== null && row.room.hostId === other.id;

    return {
      id: row.id,
      hostName: otherIsHost ? otherName : undefined,
      otherUserName: otherName,
      hostAvatar: otherIsHost ? otherAvatar : null,
      otherUserAvatar: otherAvatar,
      preview: row.lastMessagePreview ?? null,
      lastActive: (row.lastMessageAt ?? row.updatedAt).toISOString(),
      unreadCount: row.messages?.length ?? 0,
      roomTitle: row.room?.title ?? null,
    };
  }
}

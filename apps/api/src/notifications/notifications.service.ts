import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateNotificationInput {
  userId: string;
  /** message | payment | system | verification */
  type: string;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first; capped so a noisy inbox can never flood the client. */
  async list(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      actionUrl: actionUrlFor(n),
      referenceType: n.referenceType,
      referenceId: n.referenceId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  /** Clears the unread badge; safe to call when there is nothing to clear. */
  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  }

  /**
   * Fan-out used by messaging. Kept here so notification shape (type strings,
   * reference conventions) stays defined in one place.
   */
  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
      },
    });
  }
}

/**
 * The schema stores no `actionUrl` column, so the deep link is derived from
 * the notification's type and reference. Anything without a safe target
 * returns `null` and renders as a non-interactive card.
 */
function actionUrlFor(n: {
  type: string;
  referenceType: string | null;
  referenceId: string | null;
}): string | null {
  if (n.type === "message" && n.referenceId) {
    return `/chat/${n.referenceId}`;
  }
  if (n.type === "verification") {
    return "/settings";
  }
  return null;
}

/** Reference conventions shared with the producers. */
export const NOTIFICATION_REFS = {
  conversation: "conversation",
  room: "room",
} as const;

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HostService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Headline numbers for the host dashboard. The platform only shows
   * availability and lets people chat (Craigslist-style), so the stats cover
   * live inventory and the enquiries waiting on the host:
   *   - listings count live inventory (active or paused), excluding drafts
   *     and archived rows so the number matches what a searcher could see;
   *   - threads/unread cover conversations where the host is a participant,
   *     with unread only counting messages the host has not received yet.
   */
  async getStats(hostId: string) {
    const involvesHost = {
      OR: [{ participantA: hostId }, { participantB: hostId }],
    };

    const [listingCount, activeCount, threadCount, unreadCount] =
      await Promise.all([
        this.prisma.room.count({
          where: { hostId, status: { in: ["ACTIVE", "PAUSED"] } },
        }),
        this.prisma.room.count({ where: { hostId, status: "ACTIVE" } }),
        this.prisma.conversation.count({ where: involvesHost }),
        this.prisma.message.count({
          where: {
            readAt: null,
            senderId: { not: hostId },
            conversation: involvesHost,
          },
        }),
      ]);

    return {
      totalListings: listingCount,
      activeListings: activeCount,
      conversations: threadCount,
      unreadMessages: unreadCount,
    };
  }
}

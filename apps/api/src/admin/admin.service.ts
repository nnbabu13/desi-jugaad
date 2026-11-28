import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Everything the reviewer needs to decide, plus the verdict already on record.
 *
 * `area` is a neighbourhood label only - this projection can never carry an
 * exact residential address (Prompt.md 3), admin or not. Host email is
 * included because a reviewer has to know who posted it.
 */
const QUEUE_SELECT = {
  id: true,
  title: true,
  description: true,
  accommodationType: true,
  furnished: true,
  rent: true,
  currency: true,
  area: true,
  rooms: true,
  photos: true,
  status: true,
  demoData: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  city: {
    select: {
      name: true,
      country: { select: { name: true, isoCode: true } },
    },
  },
  host: {
    select: {
      id: true,
      email: true,
      profile: { select: { fullName: true } },
    },
  },
} satisfies Prisma.RoomSelect;

type QueueRow = Prisma.RoomGetPayload<{ select: typeof QUEUE_SELECT }>;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The review queue: what is waiting, and what was already turned down (so a
   * rejected listing stays visible with its reason until the owner resubmits
   * or archives it). Oldest first - first in, first reviewed.
   */
  async moderationQueue() {
    const [pending, rejected] = await Promise.all([
      this.prisma.room.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: QUEUE_SELECT,
      }),
      this.prisma.room.findMany({
        where: { status: "REJECTED" },
        orderBy: { reviewedAt: "desc" },
        select: QUEUE_SELECT,
      }),
    ]);

    return {
      pending,
      rejected,
      counts: { pending: pending.length, rejected: rejected.length },
    };
  }

  /** Only a submitted listing has a decision to make. */
  private async findReviewable(id: string): Promise<{ id: string; status: string }> {
    const room = await this.prisma.room.findFirst({
      where: { id },
      select: { id: true, status: true },
    });

    if (!room) throw new NotFoundException("Listing not found.");
    if (room.status !== "PENDING" && room.status !== "REJECTED") {
      throw new BadRequestException(
        `Only submitted listings can be reviewed - this one is ${room.status}.`,
      );
    }
    return room;
  }

  /**
   * Approval act: the listing becomes visible everywhere. Clearing reviewNote
   * matters - a stale rejection reason must never sit beside a live listing.
   */
  async approve(id: string, adminId: string): Promise<QueueRow> {
    await this.findReviewable(id);

    return this.prisma.room.update({
      where: { id },
      data: {
        status: "ACTIVE",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: null,
      },
      select: QUEUE_SELECT,
    });
  }

  /**
   * Rejection: stays off every public query (all of them filter ACTIVE) and
   * records why, so the owner can fix the specific problem and resubmit.
   */
  async reject(id: string, adminId: string, reason: string): Promise<QueueRow> {
    await this.findReviewable(id);

    return this.prisma.room.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
      select: QUEUE_SELECT,
    });
  }
}

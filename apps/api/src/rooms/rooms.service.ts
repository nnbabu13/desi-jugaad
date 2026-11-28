import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateRoomDto,
  ListRoomsDto,
  UpdateRoomDto,
} from "./rooms.dto";

/**
 * Only the fields the mobile app renders. Exact residential addresses are
 * never part of this projection: `area` is a neighbourhood label only
 * (Prompt.md 3).
 */
const ROOM_SELECT = {
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
  availableFrom: true,
  billsIncluded: true,
  houseRules: true,
  status: true,
  // Admin verdict: null on a live listing (approval clears it), and the
  // rejection reason otherwise - only the owner/admin can ever read those.
  reviewNote: true,
  demoData: true,
  createdAt: true,
  city: { select: { name: true } },
  host: {
    select: {
      profile: { select: { fullName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.RoomSelect;

type RoomRow = Prisma.RoomGetPayload<{ select: typeof ROOM_SELECT }>;

/** What the write paths need about the caller: identity plus the live role. */
interface ListingCaller {
  id: string;
  role: string;
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public, read-only feed of ACTIVE listings ordered newest first. */
  async list(dto: ListRoomsDto) {
    const rooms = await this.prisma.room.findMany({
      where: {
        status: "ACTIVE",
        // `city` and `country` nest in one relation so both AND together:
        // ?country=GB&city=London pins one city inside one country.
        ...(dto.city || dto.country
          ? {
              city: {
                ...(dto.city
                  ? { name: { equals: dto.city, mode: "insensitive" as const } }
                  : {}),
                ...(dto.country
                  ? {
                      country: {
                        isoCode: {
                          equals: dto.country,
                          mode: "insensitive" as const,
                        },
                      },
                    }
                  : {}),
              },
            }
          : {}),
        ...(dto.q
          ? {
              OR: [
                { title: { contains: dto.q, mode: "insensitive" } },
                { description: { contains: dto.q, mode: "insensitive" } },
                { area: { contains: dto.q, mode: "insensitive" } },
                { city: { name: { contains: dto.q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: ROOM_SELECT,
    });

    return rooms.map(presentRoom);
  }

  /**
   * Public detail view - plus owner/admin access to an unapproved listing, so
   * a host can open what they just submitted. Everyone else still gets a 404
   * for a non-ACTIVE row, which means a listing awaiting review never
   * advertises its existence to strangers.
   */
  async getOne(id: string, viewer?: ListingCaller) {
    const room = await this.prisma.room.findFirst({
      where: { id },
      select: { ...ROOM_SELECT, hostId: true },
    });

    if (!room) {
      throw new NotFoundException("Room not found.");
    }

    const maySee =
      room.status === "ACTIVE" ||
      viewer?.id === room.hostId ||
      viewer?.role === "ADMIN";
    if (!maySee) {
      throw new NotFoundException("Room not found.");
    }

    return presentRoom(room);
  }

  /* ------------------------------------------------------------------ write */

  /**
   * Publishes a listing for the signed-in host. `demoData` is always false:
   * only the seed may create sample content, so a member's listing can never
   * be mistaken for seeded data (Prompt.md 14 & 19).
   */
  async create(hostId: string, dto: CreateRoomDto) {
    const cityId = await this.resolveCityId(dto.cityName);

    // Approval gate: nothing a member posts is public the moment it is
    // created. Only an explicit draft stays a draft; every other create waits
    // in the admin queue. The client cannot request ACTIVE - that decision
    // belongs to the review action alone.
    const status = dto.status === "DRAFT" ? "DRAFT" : "PENDING";

    const room = await this.prisma.room.create({
      data: {
        hostId,
        title: dto.title,
        description: dto.description,
        accommodationType: dto.accommodationType,
        furnished: dto.furnished ?? "unfurnished",
        rent: dto.rent,
        currency: dto.currency,
        area: dto.area ?? null,
        cityId,
        rooms: dto.rooms ?? 1,
        photos: dto.photos ?? [],
        status,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        billsIncluded: dto.billsIncluded ?? null,
        houseRules: dto.houseRules ?? null,
        demoData: false,
      },
      select: ROOM_SELECT,
    });

    return presentRoom(room);
  }

  /** Every listing the caller owns, in any status, newest first. */
  async mine(hostId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { hostId },
      orderBy: { createdAt: "desc" },
      select: ROOM_SELECT,
    });

    return rooms.map(presentRoom);
  }

  /**
   * Updates one of the caller's own listings; never touches anyone else's.
   *
   * Approval is not self-service: ACTIVE is only applied to a listing that was
   * already public (live, or paused by its owner) or when the caller is an
   * admin. A PENDING, REJECTED or DRAFT listing has to go back through the
   * review queue instead, so editing content can never be used to skip review.
   */
  async update(id: string, caller: ListingCaller, dto: UpdateRoomDto) {
    const room = await this.prisma.room.findFirst({
      where: { id },
      select: { id: true, hostId: true, status: true },
    });

    if (!room) throw new NotFoundException("Room not found.");
    if (room.hostId !== caller.id) {
      throw new ForbiddenException("You can only edit your own listings.");
    }

    if (dto.status !== undefined && dto.status === "ACTIVE") {
      const alreadyPublic = room.status === "ACTIVE" || room.status === "PAUSED";
      if (!alreadyPublic && caller.role !== "ADMIN") {
        throw new ForbiddenException(
          "This listing has not been approved yet. It goes live once an admin approves it.",
        );
      }
    }

    const cityChanged = dto.cityName !== undefined;
    const cityId = cityChanged ? await this.resolveCityId(dto.cityName) : undefined;

    // Submitting for review - first time or after a rejection - starts the
    // decision over so a stale verdict can never read as a fresh approval.
    const resubmitting = dto.status === "PENDING";

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.accommodationType !== undefined
          ? { accommodationType: dto.accommodationType }
          : {}),
        ...(dto.furnished !== undefined ? { furnished: dto.furnished } : {}),
        ...(dto.rent !== undefined ? { rent: dto.rent } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.area !== undefined ? { area: dto.area || null } : {}),
        ...(cityChanged ? { cityId } : {}),
        ...(dto.rooms !== undefined ? { rooms: dto.rooms } : {}),
        ...(dto.photos !== undefined ? { photos: dto.photos } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(resubmitting
          ? { reviewedAt: null, reviewedBy: null, reviewNote: null }
          : {}),
        ...(dto.availableFrom !== undefined
          ? { availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null }
          : {}),
        ...(dto.billsIncluded !== undefined ? { billsIncluded: dto.billsIncluded } : {}),
        ...(dto.houseRules !== undefined ? { houseRules: dto.houseRules || null } : {}),
      },
      select: ROOM_SELECT,
    });

    return presentRoom(updated);
  }

  /** Deletes one of the caller's own listings. */
  async remove(id: string, hostId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id },
      select: { id: true, hostId: true },
    });

    if (!room) throw new NotFoundException("Room not found.");
    if (room.hostId !== hostId) {
      throw new ForbiddenException("You can only delete your own listings.");
    }

    await this.prisma.room.delete({ where: { id } });
    return { ok: true as const };
  }

  /**
   * Resolves a city name (case-insensitive) to its id so a listing lands
   * under the right city filter. Unknown names store no city rather than
   * inventing one - the listing still appears in the unfiltered feed and its
   * neighbourhood is shown instead.
   */
  private async resolveCityId(cityName?: string): Promise<string | null> {
    if (!cityName) return null;
    const city = await this.prisma.city.findFirst({
      where: { name: { equals: cityName, mode: "insensitive" } },
      select: { id: true },
    });
    return city?.id ?? null;
  }
}

function presentRoom(room: RoomRow) {
  return {
    id: room.id,
    title: room.title,
    description: room.description,
    accommodationType: room.accommodationType,
    furnished: room.furnished,
    rent: room.rent,
    currency: room.currency,
    // Neighbourhood only - never an exact residential address.
    area: room.area ?? null,
    address: room.area ?? null,
    city: room.city?.name ?? null,
    rooms: room.rooms,
    photos: room.photos,
    availableFrom: room.availableFrom ? room.availableFrom.toISOString().slice(0, 10) : null,
    billsIncluded: room.billsIncluded,
    houseRules: room.houseRules ?? null,
    status: room.status,
    // Why the last review rejected it, if it is rejected. Cleared on approval
    // and on resubmission, so a live listing can never carry a stale verdict.
    reviewNote: room.reviewNote ?? null,
    landlordName: room.host.profile?.fullName ?? "Host",
    landlordAvatar: room.host.profile?.avatarUrl ?? null,
    // Sample content flag: the UI renders a "Sample" chip and must never show
    // a verified badge for these records (Prompt.md 14 & 19).
    demoData: room.demoData,
    createdAt: room.createdAt.toISOString(),
  };
}

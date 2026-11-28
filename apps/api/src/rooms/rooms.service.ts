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

  async getOne(id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, status: "ACTIVE" },
      select: ROOM_SELECT,
    });

    if (!room) {
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
        status: dto.status ?? "ACTIVE",
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

  /** Updates one of the caller's own listings; never touches anyone else's. */
  async update(id: string, hostId: string, dto: UpdateRoomDto) {
    const room = await this.prisma.room.findFirst({
      where: { id },
      select: { id: true, hostId: true },
    });

    if (!room) throw new NotFoundException("Room not found.");
    if (room.hostId !== hostId) {
      throw new ForbiddenException("You can only edit your own listings.");
    }

    const cityChanged = dto.cityName !== undefined;
    const cityId = cityChanged ? await this.resolveCityId(dto.cityName) : undefined;

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
    landlordName: room.host.profile?.fullName ?? "Host",
    landlordAvatar: room.host.profile?.avatarUrl ?? null,
    // Sample content flag: the UI renders a "Sample" chip and must never show
    // a verified badge for these records (Prompt.md 14 & 19).
    demoData: room.demoData,
    createdAt: room.createdAt.toISOString(),
  };
}

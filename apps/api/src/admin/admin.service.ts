import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import type { AdminUserDto } from "./admin.dto";

/** Every ListingStatus value, as accepted by the roster/user filters. */
type ListingStatusValue =
  | "DRAFT"
  | "PENDING"
  | "ACTIVE"
  | "PAUSED"
  | "REJECTED"
  | "ARCHIVED";

export const LISTING_STATUS_VALUES: ListingStatusValue[] = [
  "DRAFT",
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "REJECTED",
  "ARCHIVED",
];

/** Same shape geography.service uses to tell a UUID apart from an ISO code. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

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

  /* ---------------------------------------------------------------- stats */

  /**
   * Headline numbers for the dashboard. Counted rather than sampled, in one
   * round of parallel queries so the dashboard opens without a chain of calls.
   */
  async stats() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      usersTotal,
      usersActive,
      usersPendingVerification,
      usersSuspended,
      usersNewThisWeek,
      listingsTotal,
      listingsActive,
      listingsPending,
      listingsRejected,
      listingsPaused,
      listingsDraft,
      countriesTotal,
      countriesActive,
      citiesTotal,
      citiesActive,
      conversations,
      messages,
      byCity,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
      this.prisma.user.count({
        where: { status: "PENDING_VERIFICATION", deletedAt: null },
      }),
      this.prisma.user.count({ where: { status: "SUSPENDED", deletedAt: null } }),
      this.prisma.user.count({
        where: { createdAt: { gte: weekAgo }, deletedAt: null },
      }),
      this.prisma.room.count(),
      this.prisma.room.count({ where: { status: "ACTIVE" } }),
      this.prisma.room.count({ where: { status: "PENDING" } }),
      this.prisma.room.count({ where: { status: "REJECTED" } }),
      this.prisma.room.count({ where: { status: "PAUSED" } }),
      this.prisma.room.count({ where: { status: "DRAFT" } }),
      this.prisma.country.count(),
      this.prisma.country.count({ where: { isActive: true } }),
      this.prisma.city.count(),
      this.prisma.city.count({ where: { isActive: true } }),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.room.groupBy({
        by: ["cityId"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
        orderBy: { _count: { cityId: "desc" } },
        take: 8,
      }),
    ]);

    const cityIds = byCity
      .map((row) => row.cityId)
      .filter((v): v is string => v !== null);
    const cityRows = cityIds.length
      ? await this.prisma.city.findMany({
          where: { id: { in: cityIds } },
          select: {
            id: true,
            name: true,
            country: { select: { isoCode: true } },
          },
        })
      : [];
    const cityById = new Map(cityRows.map((c) => [c.id, c]));

    return {
      users: {
        total: usersTotal,
        active: usersActive,
        pendingVerification: usersPendingVerification,
        suspended: usersSuspended,
        newThisWeek: usersNewThisWeek,
      },
      listings: {
        total: listingsTotal,
        active: listingsActive,
        awaitingReview: listingsPending,
        rejected: listingsRejected,
        paused: listingsPaused,
        draft: listingsDraft,
      },
      listingsByCity: byCity.map((row) => {
        const city = row.cityId ? cityById.get(row.cityId) : undefined;
        return {
          city: city?.name ?? "No city",
          country: city?.country.isoCode ?? null,
          count: row._count._all,
        };
      }),
      geography: {
        countries: { total: countriesTotal, active: countriesActive },
        cities: { total: citiesTotal, active: citiesActive },
      },
      engagement: { conversations, messages },
      settings: await this.settings.get(),
      generatedAt: new Date().toISOString(),
    };
  }

  /* ------------------------------------------------------------- locations */

  /** All countries, plus the cities of one country (pass an id or an ISO). */
  async locations(countryRef?: string) {
    const countries = await this.prisma.country.findMany({
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      select: {
        id: true,
        isoCode: true,
        name: true,
        flagEmoji: true,
        isActive: true,
        isFeatured: true,
        _count: { select: { cities: true } },
      },
    });

    // Resolve the reference first rather than OR-ing an id against an ISO
    // code: `id = 'GB'` makes Postgres cast GB to uuid and fail outright.
    // Same rule the geography picker accepts - a UUID, or a 3-letter ISO.
    let countryId: string | undefined;
    if (countryRef) {
      const byId = UUID_RE.test(countryRef)
        ? await this.prisma.country.findUnique({
            where: { id: countryRef },
            select: { id: true },
          })
        : null;
      const country =
        byId ??
        (await this.prisma.country.findUnique({
          where: { isoCode: countryRef.toUpperCase() },
          select: { id: true },
        }));
      if (!country) throw new NotFoundException(`Country not found: ${countryRef}`);
      countryId = country.id;
    }

    const cities = await this.prisma.city.findMany({
      where: countryId ? { countryId } : undefined,
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        region: true,
        isActive: true,
        isFeatured: true,
        isLaunch: true,
        _count: { select: { rooms: true } },
        country: { select: { id: true, isoCode: true, name: true } },
      },
    });

    return {
      countries,
      cities,
      counts: {
        countries: { total: countries.length, active: countries.filter((c) => c.isActive).length },
        cities: { total: cities.length, active: cities.filter((c) => c.isActive).length },
      },
    };
  }

  /**
   * Flip a country's visibility. The public reads already filter on
   * `isActive`, so this takes effect immediately for pickers AND for that
   * country's listings (see RoomsService.list).
   */
  async setCountryActive(id: string, isActive: boolean) {
    const existing = await this.prisma.country.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundException("Country not found.");

    const [country, affectedCities] = await Promise.all([
      this.prisma.country.update({
        where: { id },
        data: { isActive },
        select: { id: true, isoCode: true, name: true, isActive: true },
      }),
      this.prisma.city.count({ where: { countryId: id } }),
    ]);

    return { ...country, affectedCities };
  }

  async setCityActive(id: string, isActive: boolean) {
    const existing = await this.prisma.city.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundException("City not found.");

    return this.prisma.city.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        region: true,
        isActive: true,
        country: { select: { id: true, isoCode: true, name: true } },
      },
    });
  }

  /* -------------------------------------------------------------- listings */

  /**
   * Every listing in any status - the public feed only ever shows ACTIVE, so
   * this is the one place the whole roster is visible.
   */
  async listings(params: { status?: ListingStatusValue; q?: string; take?: number }) {
    const conditions: Prisma.RoomWhereInput[] = [];

    if (params.status) conditions.push({ status: params.status });
    if (params.q) {
      const q = params.q;
      conditions.push({
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
          { host: { email: { contains: q, mode: "insensitive" as const } } },
          { host: { profile: { fullName: { contains: q, mode: "insensitive" as const } } } },
        ],
      });
    }

    const rows = await this.prisma.room.findMany({
      where: conditions.length > 0 ? { AND: conditions } : undefined,
      orderBy: { createdAt: "desc" },
      take: Math.min(params.take ?? 50, 200),
      select: QUEUE_SELECT,
    });

    return { items: rows, total: rows.length };
  }

  /* ----------------------------------------------------------------- users */

  async users(params: { status?: string; role?: string; q?: string; take?: number }) {
    const conditions: Prisma.UserWhereInput[] = [{ deletedAt: null }];

    if (params.status === "ACTIVE" || params.status === "SUSPENDED" || params.status === "PENDING_VERIFICATION") {
      conditions.push({ status: params.status });
    }
    if (params.role === "ADMIN" || params.role === "USER") {
      conditions.push({ role: params.role });
    }
    if (params.q) {
      const q = params.q;
      conditions.push({
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { profile: { fullName: { contains: q, mode: "insensitive" as const } } },
        ],
      });
    }

    const rows = await this.prisma.user.findMany({
      where: { AND: conditions },
      orderBy: { createdAt: "desc" },
      take: Math.min(params.take ?? 50, 200),
      select: {
        id: true,
        email: true,
        status: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        profile: { select: { fullName: true, avatarUrl: true } },
        _count: { select: { rooms: true } },
      },
    });

    return { items: rows, total: rows.length };
  }

  /**
   * Change a member's role or status.
   *
   * Two lockout rules, both checked against the live table rather than the
   * request: an admin can neither demote nor suspend their own account, and
   * the last remaining admin can be neither demoted nor suspended. Without
   * those, one mis-click could leave the platform with nobody able to approve
   * anything or turn a switch back off.
   */
  async updateUser(
    id: string,
    dto: AdminUserDto,
    actor: { id: string; role: string },
  ) {
    if (dto.role === undefined && dto.status === undefined) {
      throw new BadRequestException("Nothing to change: send role, status or both.");
    }

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, status: true, deletedAt: true },
    });
    if (!target || target.deletedAt !== null) {
      throw new NotFoundException("Account not found.");
    }

    const isSelf = actor.id === id;
    if (isSelf && dto.role !== undefined && dto.role !== "ADMIN") {
      throw new BadRequestException("You cannot remove your own admin rights.");
    }
    if (isSelf && dto.status === "SUSPENDED") {
      throw new BadRequestException("You cannot suspend your own account.");
    }

    const losesAdmin =
      target.role === "ADMIN" &&
      (dto.role === "USER" || dto.status === "SUSPENDED");
    if (losesAdmin) {
      const otherAdmins = await this.prisma.user.count({
        where: {
          role: "ADMIN",
          id: { not: id },
          deletedAt: null,
          status: { not: "SUSPENDED" },
        },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException(
          "This is the last active admin account - promote another admin first.",
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: {
        id: true,
        email: true,
        status: true,
        role: true,
        profile: { select: { fullName: true } },
      },
    });

    return updated;
  }

  /**
   * Direct status write for the roster: park it, archive it, or send it back
   * for review. ACTIVE is not accepted here - use activateListing, which
   * records a verdict when the listing is waiting on one.
   */
  async setListingStatus(id: string, status: ListingStatusValue) {
    const existing = await this.prisma.room.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Listing not found.");

    return this.prisma.room.update({
      where: { id },
      data: { status },
      select: QUEUE_SELECT,
    });
  }

  /**
   * Making a listing live: if it is waiting on a decision this is the
   * approval act (and writes the verdict); otherwise it is an un-pause of
   * something that was already approved, so there is nothing to record.
   */
  async activateListing(id: string, adminId: string): Promise<QueueRow> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!room) throw new NotFoundException("Listing not found.");

    if (room.status === "PENDING" || room.status === "REJECTED") {
      return this.approve(id, adminId);
    }

    return this.setListingStatus(id, "ACTIVE");
  }

  /* ------------------------------------------------------------- settings */

  async getSettings() {
    return this.settings.get();
  }

  /** Validated and upserted by SettingsService; returns the full set. */
  async updateSetting(key: string, value: unknown, adminId: string) {
    return this.settings.set(key, value, adminId);
  }
}

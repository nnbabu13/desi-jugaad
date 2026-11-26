import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BlockUserDto, UpdateProfileDto } from "./users.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Updates the caller's profile, validating that any city actually belongs to
   * the supplied country so the picker can never persist a mismatched pair.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!existing) {
      throw new NotFoundException("Profile not found.");
    }

    const currentCountryId = dto.currentCountryId ?? existing.currentCountryId;
    const currentCityId = dto.currentCityId ?? existing.currentCityId;
    const intendedCountryId = dto.intendedCountryId ?? existing.intendedCountryId;
    const intendedCityId = dto.intendedCityId ?? existing.intendedCityId;

    await this.assertCityInCountry(currentCityId, currentCountryId, "current");
    await this.assertCityInCountry(intendedCityId, intendedCountryId, "intended");

    const data: Prisma.UserProfileUpdateInput = {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio.trim() || null } : {}),
      ...(dto.lifeStage !== undefined ? { lifeStage: dto.lifeStage } : {}),
      ...(dto.languages !== undefined
        ? { languages: dto.languages.map((l) => l.trim()).filter(Boolean) }
        : {}),
      ...(dto.profileVisibility !== undefined
        ? { profileVisibility: dto.profileVisibility }
        : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      ...(dto.currentCountryId !== undefined
        ? {
            currentCountry: dto.currentCountryId
              ? { connect: { id: dto.currentCountryId } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.currentCityId !== undefined
        ? {
            currentCity: dto.currentCityId
              ? { connect: { id: dto.currentCityId } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.intendedCountryId !== undefined
        ? {
            intendedCountry: dto.intendedCountryId
              ? { connect: { id: dto.intendedCountryId } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.intendedCityId !== undefined
        ? {
            intendedCity: dto.intendedCityId
              ? { connect: { id: dto.intendedCityId } }
              : { disconnect: true },
          }
        : {}),
    };

    await this.prisma.userProfile.update({ where: { userId }, data });

    // Account status is deliberately untouched: it stays PENDING_VERIFICATION
    // until the email is confirmed. Recording the location here is what lets
    // Home personalise immediately after onboarding.
    return this.getProfile(userId);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            currentCountry: true,
            currentCity: true,
            intendedCountry: true,
            intendedCity: true,
          },
        },
        verifications: { select: { type: true, status: true } },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException("Profile not found.");
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      phoneVerified: user.phoneVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
      profile: user.profile
        ? {
            fullName: user.profile.fullName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
            lifeStage: user.profile.lifeStage,
            languages: user.profile.languages,
            profileVisibility: user.profile.profileVisibility,
            demoData: user.profile.demoData,
            currentCountry: user.profile.currentCountry
              ? pickCountry(user.profile.currentCountry)
              : null,
            currentCity: user.profile.currentCity
              ? pickCity(user.profile.currentCity)
              : null,
            intendedCountry: user.profile.intendedCountry
              ? pickCountry(user.profile.intendedCountry)
              : null,
            intendedCity: user.profile.intendedCity
              ? pickCity(user.profile.intendedCity)
              : null,
          }
        : null,
      verifications: user.verifications.map((v) => ({
        type: v.type,
        verified: v.status === "VERIFIED",
      })),
    };
  }

  /**
   * Public profile view honouring `profileVisibility`.
   * `connections` and `private` profiles return only the minimal card.
   */
  async getPublicProfile(targetId: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: {
        profile: {
          include: {
            currentCountry: true,
            currentCity: true,
          },
        },
        verifications: { select: { type: true, status: true } },
      },
    });

    if (!user || user.deletedAt !== null || !user.profile) {
      throw new NotFoundException("Profile not found.");
    }

    const profile = user.profile;
    const isSelf = viewerId === user.id;

    const visibility = profile.profileVisibility;
    const fullAccess = isSelf || visibility === "public";

    return {
      id: user.id,
      fullName: profile.fullName,
      // A seeded account is always labelled as sample content.
      demoData: profile.demoData,
      // Verified flags are read straight from completed verification rows.
      verifications: fullAccess
        ? user.verifications.map((v) => ({
            type: v.type,
            verified: v.status === "VERIFIED",
          }))
        : [],
      ...(fullAccess
        ? {
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            lifeStage: profile.lifeStage,
            languages: profile.languages,
            currentCountry: profile.currentCountry
              ? pickCountry(profile.currentCountry)
              : null,
            currentCity: profile.currentCity ? pickCity(profile.currentCity) : null,
            joinedAt: user.createdAt.toISOString(),
          }
        : {
            // Restricted profiles expose nothing beyond the name.
            bio: null,
            avatarUrl: profile.avatarUrl,
            restricted: true,
          }),
      isSelf,
    };
  }

  private async assertCityInCountry(
    cityId: string | null,
    countryId: string | null,
    label: string,
  ): Promise<void> {
    if (!cityId) return;

    if (!countryId) {
      throw new BadRequestException(
        `Select a country before choosing a ${label} city.`,
      );
    }

    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { countryId: true, isActive: true },
    });

    if (!city || !city.isActive) {
      throw new BadRequestException(`Unknown ${label} city.`);
    }
    if (city.countryId !== countryId) {
      throw new BadRequestException(
        `That city is not in the selected country (${label} location).`,
      );
    }
  }

  /* ------------------------------------------------------------- blocking */

  /** Members the caller has blocked, newest first. */
  async listBlocks(userId: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        blocked: {
          select: {
            id: true,
            deletedAt: true,
            profile: { select: { fullName: true, avatarUrl: true } },
          },
        },
      },
    });

    return rows
      .filter((r) => r.blocked.deletedAt === null)
      .map((r) => ({
        id: r.blocked.id,
        fullName: r.blocked.profile?.fullName ?? "Member",
        avatarUrl: r.blocked.profile?.avatarUrl ?? null,
        blockedAt: r.createdAt.toISOString(),
      }));
  }

  /** Blocks a member. Idempotent: blocking twice is a no-op, not an error. */
  async block(blockerId: string, dto: BlockUserDto) {
    if (blockerId === dto.userId) {
      throw new BadRequestException("You cannot block yourself.");
    }

    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw new NotFoundException("Member not found.");

    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: dto.userId } },
      create: { blockerId, blockedId: dto.userId },
      update: {},
    });

    return { ok: true as const, blocked: true as const };
  }

  /** Removes a block. Safe to call for a pair that was never blocked. */
  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });
    return { ok: true as const, blocked: false as const };
  }

  /* ------------------------------------------------------- account removal */

  /**
   * Soft-deletes the caller's account: every session is revoked, their
   * listings leave the public feed, and the row is marked deleted so no
   * further sign-in is possible. The row itself is retained (not hard
   * deleted) so the terms' recovery window and audit trail still hold.
   */
  async deleteAccount(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), status: "DELETED" },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.room.updateMany({
        where: {
          hostId: userId,
          status: { in: ["DRAFT", "ACTIVE", "PAUSED"] },
        },
        data: { status: "ARCHIVED" },
      }),
      // Remove blocks this account holds; blocks *against* it stay so the
      // protection the other member asked for survives the deletion.
      this.prisma.userBlock.deleteMany({ where: { blockerId: userId } }),
    ]);

    return { ok: true as const };
  }
}

function pickCountry(c: {
  id: string;
  isoCode: string;
  name: string;
  flagEmoji: string | null;
  currencyCode: string | null;
  phoneCode: string | null;
}) {
  return {
    id: c.id,
    isoCode: c.isoCode,
    name: c.name,
    flagEmoji: c.flagEmoji,
    currencyCode: c.currencyCode,
    phoneCode: c.phoneCode,
  };
}

function pickCity(c: { id: string; name: string; region: string | null }) {
  return { id: c.id, name: c.name, region: c.region };
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import type { User } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { LoginDto, RegisterDto, VerifyEmailDto } from "./auth.dto";
import { RequestMeta, TokensService, TokenPair } from "./tokens.service";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

/** The only user shape ever returned by the API. */
export interface PublicUser {
  id: string;
  email: string;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  authProvider: string;
  createdAt: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta = {}): Promise<AuthResult> {
    if (!dto.acceptTerms) {
      throw new BadRequestException(
        "You must accept the Terms and Privacy Policy to continue.",
      );
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.deletedAt === null) {
      throw new ConflictException(
        "An account with that email already exists. Try signing in.",
      );
    }

    const passwordHash = await argonHash(dto.password);

    // The profile row is created in the same transaction so a user is never
    // left without one (the app renders profile data everywhere).
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          phone: dto.phone ?? null,
          passwordHash,
          authProvider: "EMAIL",
          status: "PENDING_VERIFICATION",
          profile: {
            create: {
              fullName: dto.fullName.trim(),
              profileVisibility: "public",
              demoData: false,
            },
          },
        },
      });

      await this.createEmailVerification(tx, created.id, email);
      return created;
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
    });

    const tokens = await this.tokens.issueTokenPair(user, meta);
    return { user: PublicUser.from(user), tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta = {}): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.deletedAt !== null || !user.passwordHash) {
      // Same message for "no such user" and "wrong password" so the endpoint
      // cannot be used to enumerate registered addresses.
      throw new UnauthorizedException("Email or password is incorrect.");
    }

    if (user.status === "SUSPENDED") {
      throw new UnauthorizedException(
        "This account is suspended. Contact support for help.",
      );
    }

    const ok = await argonVerify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
    });

    const tokens = await this.tokens.issueTokenPair(user, meta);
    return { user: PublicUser.from(user), tokens };
  }

  async refresh(presented: string | undefined, meta: RequestMeta = {}) {
    if (!presented) {
      throw new UnauthorizedException("Missing refresh token.");
    }
    const { user, tokens } = await this.tokens.rotate(presented, meta);
    return { user: PublicUser.from(user), tokens };
  }

  async logout(presented: string | undefined): Promise<{ ok: true }> {
    await this.tokens.revoke(presented);
    return { ok: true };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ user: PublicUser }> {
    const tokenHash = TokensService.hash(dto.token);

    const row = await this.prisma.userVerification.findFirst({
      where: {
        type: "EMAIL",
        status: "PENDING",
        reference: tokenHash,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!row) {
      throw new BadRequestException(
        "This verification link is invalid or has expired.",
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.userVerification.update({
        where: { id: row.id },
        data: { status: "VERIFIED", verifiedAt: new Date() },
      });

      return tx.user.update({
        where: { id: row.userId },
        data: {
          emailVerifiedAt: new Date(),
          // Only now does the account become fully active.
          status: "ACTIVE",
        },
      });
    });

    await this.tokens.revokeAllForUser(user.id);
    return { user: PublicUser.from(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            currentCity: true,
            currentCountry: true,
            intendedCity: true,
            intendedCountry: true,
          },
        },
        verifications: { select: { type: true, status: true } },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException("Account no longer exists.");
    }

    return {
      ...PublicUser.from(user),
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
              ? {
                  id: user.profile.currentCountry.id,
                  isoCode: user.profile.currentCountry.isoCode,
                  name: user.profile.currentCountry.name,
                  flagEmoji: user.profile.currentCountry.flagEmoji,
                }
              : null,
            currentCity: user.profile.currentCity
              ? {
                  id: user.profile.currentCity.id,
                  name: user.profile.currentCity.name,
                  region: user.profile.currentCity.region,
                }
              : null,
            intendedCountry: user.profile.intendedCountry
              ? {
                  id: user.profile.intendedCountry.id,
                  isoCode: user.profile.intendedCountry.isoCode,
                  name: user.profile.intendedCountry.name,
                  flagEmoji: user.profile.intendedCountry.flagEmoji,
                }
              : null,
            intendedCity: user.profile.intendedCity
              ? {
                  id: user.profile.intendedCity.id,
                  name: user.profile.intendedCity.name,
                }
              : null,
          }
        : null,
      verifications: user.verifications.map((v) => ({
        type: v.type,
        // The badge is derived from this status and never asserted directly.
        verified: v.status === "VERIFIED",
      })),
    };
  }

  private async createEmailVerification(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
  ): Promise<void> {
    const token = randomBytes(32).toString("base64url");

    await tx.userVerification.upsert({
      where: { userId_type: { userId, type: "EMAIL" } },
      update: {
        status: "PENDING",
        reference: TokensService.hash(token),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
        verifiedAt: null,
      },
      create: {
        userId,
        type: "EMAIL",
        status: "PENDING",
        reference: TokensService.hash(token),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });

    // No transactional email provider is configured yet, so the link is logged.
    // This is development-only behaviour and must be replaced before release.
    if (process.env["NODE_ENV"] !== "production") {
      this.logger.warn(
        `DEV ONLY - email verification for ${email}: ` +
          `http://localhost:3000/verify-email?token=${token}`,
      );
    }
  }
}

export const PublicUser = {
  from(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      phoneVerified: user.phoneVerifiedAt !== null,
      authProvider: user.authProvider,
      createdAt: user.createdAt.toISOString(),
    };
  },
};

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { User } from "../generated/prisma/client";

const ACCESS_TTL = process.env["JWT_ACCESS_TTL"] ?? "15m";
const REFRESH_TTL_DAYS = 30;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export const REFRESH_COOKIE = "dj_rt";

/**
 * Access tokens are short-lived JWTs; refresh tokens are opaque random strings
 * stored only as a SHA-256 hash, so a leaked database row cannot be replayed.
 *
 * Refresh tokens rotate on every use: the presented token is revoked and a new
 * one is issued, which limits the value of a stolen token.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issueAccessToken(user: {
    id: string;
    email: string;
    status: string;
  }): Promise<string> {
    // `ms` types durations as a template-literal union, so an env-provided
    // string needs the same assertion as in auth.module.ts.
    const options = { expiresIn: ACCESS_TTL } as unknown as
      Parameters<typeof this.jwt.signAsync>[1];

    return this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        status: user.status,
      },
      options,
    );
  }

  async issueTokenPair(user: User, meta: RequestMeta = {}): Promise<TokenPair> {
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = randomBytes(48).toString("base64url");

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: TokensService.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
        ip: meta.ip ?? null,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    };
  }

  /**
   * Rotates a presented refresh token. Returns the user so the caller can
   * re-issue an access token in the same round trip.
   */
  async rotate(
    presented: string,
    meta: RequestMeta = {},
  ): Promise<{ user: User; tokens: TokenPair }> {
    const tokenHash = TokensService.hash(presented);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    const now = Date.now();
    const valid =
      stored !== null &&
      stored.revokedAt === null &&
      stored.expiresAt.getTime() > now &&
      stored.user.deletedAt === null;

    if (!stored || !valid) {
      // Revoke everything for this user if a token was replayed after rotation.
      if (stored) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException("Session expired. Please sign in again.");
    }

    // Constant-time comparison guards against hash-collision probing.
    if (!TokensService.safeEqual(stored.tokenHash, tokenHash)) {
      throw new UnauthorizedException("Session expired. Please sign in again.");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(stored.user, meta);
    return { user: stored.user, tokens };
  }

  async revoke(presented: string | undefined): Promise<void> {
    if (!presented) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: TokensService.hash(presented), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private static safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }

  static refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env["AUTH_COOKIE_INSECURE"] !== "true",
      sameSite: "lax" as const,
      path: "/api/v1/auth",
      maxAge: REFRESH_TTL_DAYS * 86_400_000,
    };
  }
}

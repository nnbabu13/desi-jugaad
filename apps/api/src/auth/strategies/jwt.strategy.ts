import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  status: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

/**
 * Verifies the access token and then re-reads the account from the database.
 *
 * Checking the live row (rather than trusting token claims alone) is what makes
 * suspension and account deletion take effect immediately instead of waiting
 * for the token to expire.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret) throw new Error("JWT_SECRET is not set");

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request & { user?: AuthenticatedUser },
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException("Account no longer exists.");
    }
    if (user.status === "SUSPENDED") {
      throw new UnauthorizedException("This account is suspended.");
    }

    request.user = {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      phoneVerified: user.phoneVerifiedAt !== null,
    };

    return request.user;
  }
}

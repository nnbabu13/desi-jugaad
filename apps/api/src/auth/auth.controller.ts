import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PublicUser } from "./auth.service";
import type { AuthenticatedUser } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LoginDto, RefreshDto, RegisterDto, VerifyEmailDto } from "./auth.dto";
import { AuthService } from "./auth.service";
import { REFRESH_COOKIE, RequestMeta, TokensService } from "./tokens.service";

/**
 * Auth endpoints (Ui Plan, Part D).
 *
 * The refresh token is an httpOnly cookie scoped to /api/v1/auth, so JavaScript
 * on the client can never read it. Native clients may pass it in the body
 * instead (see RefreshDto), which is why both paths are supported.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto, AuthController.meta(req));
    AuthController.setRefreshCookie(res, result.tokens.refreshToken);
    return AuthController.envelope(result);
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, AuthController.meta(req));
    AuthController.setRefreshCookie(res, result.tokens.refreshToken);
    return AuthController.envelope(result);
  }

  @Post("refresh")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = dto.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    const result = await this.auth.refresh(
      presented,
      AuthController.meta(req),
    );
    AuthController.setRefreshCookie(res, result.tokens.refreshToken);
    return AuthController.envelope(result);
  }

  @Post("logout")
  @HttpCode(200)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = dto.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    await this.auth.logout(presented);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    return { ok: true };
  }

  @Post("verify-email")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const { user } = await this.auth.verifyEmail(dto);
    return { user };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  /** Signs this device out everywhere - used by "log out of all sessions". */
  @Post("logout-all")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(undefined);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    return { ok: true, userId: user.id };
  }

  private static meta(req: Request): RequestMeta {
    return {
      userAgent: req.headers["user-agent"],
      ip: req.ip ?? req.socket.remoteAddress ?? undefined,
    };
  }

  private static setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, TokensService.refreshCookieOptions());
  }

  private static envelope(result: {
    user: PublicUser;
    tokens: { accessToken: string; expiresIn: number };
  }) {
    // The refresh token is deliberately NOT in the body when it is also a
    // cookie - it lives in httpOnly storage instead.
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
      tokenType: "Bearer",
    };
  }
}

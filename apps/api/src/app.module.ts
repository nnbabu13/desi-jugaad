import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { GeographyModule } from "./geography/geography.module";
import { HealthModule } from "./health/health.module";
import { HostModule } from "./host/host.module";
import { MessagesModule } from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RoomsModule } from "./rooms/rooms.module";
import { SettingsModule } from "./settings/settings.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    // Environment is already loaded by main.ts from the repository root.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),

    // Baseline abuse protection: 300 requests/minute per route.
    //
    // Only ONE entry belongs here. In @nestjs/throttler v6 every throttler in
    // this array is enforced on EVERY route, so a second, tighter entry would
    // silently become a global cap - an earlier `auth` entry with limit 10 did
    // exactly that, and the default's 300 never applied; admins hit 429 after
    // eleven location toggles. Auth routes tighten themselves instead, with
    // @Throttle({ default: { limit } }) on each handler in auth.controller.
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 300 },
    ]),

    PrismaModule,
    // Global: the switch reads auth, rooms and admin all depend on.
    SettingsModule,
    HealthModule,
    GeographyModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    MessagesModule,
    NotificationsModule,
    HostModule,
    // Admin surface: every route is gated by JwtAuthGuard + AdminGuard.
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

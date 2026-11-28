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
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    // Environment is already loaded by main.ts from the repository root.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),

    // Baseline abuse protection on every route; auth routes tighten this
    // further with their own limits.
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 300 },
      { name: "auth", ttl: 60_000, limit: 10 },
    ]),

    PrismaModule,
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

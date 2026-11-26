import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule, type JwtModuleOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt.guard";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { TokensService } from "./tokens.service";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        if (!secret || secret === "CHANGE_ME") {
          throw new Error(
            "JWT_SECRET must be set to a real value. Copy .env.example to .env.",
          );
        }
        const ttl = config.get<string>("JWT_ACCESS_TTL") ?? "15m";
        // `ms` types durations as a template-literal union (StringValue), so a
        // plain `string` read from the environment needs an assertion here.
        const signOptions = {
          expiresIn: ttl,
        } as unknown as JwtModuleOptions["signOptions"];

        return { secret, signOptions };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokensService, JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [AuthService, TokensService, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}

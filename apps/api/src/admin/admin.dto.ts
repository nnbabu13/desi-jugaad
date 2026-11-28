import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { SETTING_KEYS } from "../settings/settings.service";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

/** Decision payloads for the listing review queue. */
export class RejectListingDto {
  /**
   * Required: a rejection the owner cannot act on is worse than no decision
   * at all. Shown verbatim on their listings screen so they know what to fix
   * before resubmitting.
   */
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/** Enable/disable a country or a city. The geography reads already honour it. */
export class ToggleLocationDto {
  @IsBoolean()
  isActive!: boolean;
}

/**
 * Admin control over any listing, regardless of who owns it.
 *
 * ACTIVE and PAUSED are the roster actions; PENDING sends it back for review.
 * REJECTED is deliberately absent: rejecting always needs a reason, so it
 * belongs to the moderation endpoint, never to a bare status write.
 * ARCHIVED is admin-only - owners can park a listing but not retire it.
 */
export class AdminListingStatusDto {
  @IsIn(["ACTIVE", "PAUSED", "ARCHIVED", "PENDING"])
  status!: "ACTIVE" | "PAUSED" | "ARCHIVED" | "PENDING";
}

/**
 * Account control: suspend/restore, or change the role.
 *
 * At least one field is required, and a request that would leave the platform
 * without a single admin is refused by the service rather than by validation,
 * because that depends on the current state of the table.
 */
export class AdminUserDto {
  @IsOptional()
  @IsIn(["USER", "ADMIN"])
  role?: "USER" | "ADMIN";

  @IsOptional()
  @IsIn(["ACTIVE", "SUSPENDED"])
  status?: "ACTIVE" | "SUSPENDED";
}

/**
 * `value` is boolean for some keys and string[] for others, so it carries a
 * marker decorator only - the global ValidationPipe has forbidNonWhitelisted
 * on, which would strip an undecorated property - while SettingsService does
 * the real per-key type validation.
 */
export class UpdateSettingDto {
  @IsIn(SETTING_KEYS)
  key!: (typeof SETTING_KEYS)[number];

  @IsDefined()
  value!: unknown;
}

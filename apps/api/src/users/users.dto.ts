import { Transform } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export const LIFE_STAGES = [
  "living_abroad",
  "student_abroad",
  "planning_to_move",
  "other",
] as const;

export const VISIBILITY_LEVELS = ["public", "connections", "private"] as const;

const toArray = ({ value }: { value: unknown }): unknown => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return value;
};

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsIn(LIFE_STAGES, {
    message: `lifeStage must be one of: ${LIFE_STAGES.join(", ")}`,
  })
  lifeStage?: (typeof LIFE_STAGES)[number];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  languages?: string[];

  @IsOptional()
  @IsUUID()
  currentCountryId?: string;

  @IsOptional()
  @IsUUID()
  currentCityId?: string;

  @IsOptional()
  @IsUUID()
  intendedCountryId?: string;

  @IsOptional()
  @IsUUID()
  intendedCityId?: string;

  @IsOptional()
  @IsIn(VISIBILITY_LEVELS, {
    message: `profileVisibility must be one of: ${VISIBILITY_LEVELS.join(", ")}`,
  })
  profileVisibility?: (typeof VISIBILITY_LEVELS)[number];

  /** Avatar URLs must be http(s); blocks javascript: and data: injection. */
  @IsOptional()
  @Matches(/^https?:\/\/\S+$/i, { message: "avatarUrl must be an http(s) URL" })
  @MaxLength(500)
  avatarUrl?: string;
}

export class BlockUserDto {
  /** The member being blocked. Validated as a UUID before it reaches Prisma. */
  @IsUUID()
  userId!: string;
}

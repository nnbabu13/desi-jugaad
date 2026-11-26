import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/**
 * Query filters for the public room feed. Unknown keys are rejected by the
 * global ValidationPipe (`forbidNonWhitelisted`), so a stray parameter can
 * never reach Prisma.
 */
export class ListRoomsDto {
  /** City name match (case-insensitive), e.g. `?city=London`. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  /**
   * Free-text match over title, description, neighbourhood and city name so
   * the client's single search box can filter the WHOLE feed server-side
   * (the list itself is capped at 100 rows), e.g. `?q=camberwell`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

/* ---------------------------------------------------------------------------
 * Publishing (Prompt.md §12): the only values the app may ever write.
 * ------------------------------------------------------------------------ */

export const ACCOMMODATION_TYPES = [
  "room_shared",
  "room_private",
  "entire_flat",
  "shared_house",
  "studio",
] as const;

export const FURNISHED_VALUES = [
  "furnished",
  "part_furnished",
  "unfurnished",
] as const;

export const CURRENCY_VALUES = [
  "GBP",
  "EUR",
  "USD",
  "CAD",
  "AUD",
  "AED",
  "INR",
] as const;

/** DRAFT saves without going live; ACTIVE publishes to the public feed. */
export const ROOM_WRITE_STATUSES = ["DRAFT", "ACTIVE"] as const;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

export class CreateRoomDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsIn(ACCOMMODATION_TYPES)
  accommodationType!: (typeof ACCOMMODATION_TYPES)[number];

  @IsOptional()
  @IsIn(FURNISHED_VALUES)
  furnished?: (typeof FURNISHED_VALUES)[number];

  // Monthly rent in whole currency units (Prompt.md 4 & 12).
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  rent!: number;

  @IsIn(CURRENCY_VALUES)
  currency!: (typeof CURRENCY_VALUES)[number];

  /**
   * Free text like "London, Hammersmith": the service resolves the city by
   * name and stores the rest as the neighbourhood (`area`). Exact addresses
   * are never stored (Prompt.md 3).
   */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cityName?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  area?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rooms?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_tld: false, require_protocol: true }, { each: true })
  photos?: string[];

  @IsOptional()
  @IsIn(ROOM_WRITE_STATUSES)
  status?: (typeof ROOM_WRITE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsBoolean()
  billsIncluded?: boolean;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(600)
  houseRules?: string;
}

export class UpdateRoomDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn(ACCOMMODATION_TYPES)
  accommodationType?: (typeof ACCOMMODATION_TYPES)[number];

  @IsOptional()
  @IsIn(FURNISHED_VALUES)
  furnished?: (typeof FURNISHED_VALUES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  rent?: number;

  @IsOptional()
  @IsIn(CURRENCY_VALUES)
  currency?: (typeof CURRENCY_VALUES)[number];

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cityName?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  area?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rooms?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_tld: false, require_protocol: true }, { each: true })
  photos?: string[];

  /** Full status control for the owner's own listing, incl. PAUSED. */
  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "PAUSED"])
  status?: "DRAFT" | "ACTIVE" | "PAUSED";

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsBoolean()
  billsIncluded?: boolean;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(600)
  houseRules?: string;
}

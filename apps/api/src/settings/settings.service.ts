import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Platform switches - the admin's "enable/disable everything" lever.
 *
 * Stored as one row per key in platform_settings rather than columns, so a
 * new switch never needs a migration. Reads are a single query on a table of
 * a handful of rows; no cache, because a stale switch is worse than a query.
 */

/** Category ids the client renders (mirrors CATEGORIES in the mobile app). */
export const CATEGORY_IDS = ["rentals", "services", "parcel", "community"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface PlatformSettings {
  /** Categories hidden everywhere in the UI. */
  disabledCategories: CategoryId[];
  /** Blocks member listing writes; admins are unaffected, reads stay open. */
  maintenanceMode: boolean;
  /** When false, POST /auth/register refuses new accounts. */
  registrationOpen: boolean;
}

export type SettingKey = keyof PlatformSettings;

export const SETTING_KEYS: SettingKey[] = [
  "disabledCategories",
  "maintenanceMode",
  "registrationOpen",
];

export const DEFAULT_SETTINGS: PlatformSettings = {
  disabledCategories: [],
  maintenanceMode: false,
  registrationOpen: true,
};

function isSettingKey(value: string): value is SettingKey {
  return (SETTING_KEYS as string[]).includes(value);
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current switches, with defaults filling in anything never touched. */
  async get(): Promise<PlatformSettings> {
    const rows = await this.prisma.platformSetting.findMany({
      select: { key: true, value: true },
    });

    const settings: PlatformSettings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (!isSettingKey(row.key)) continue;
      // Every stored value was validated on the way in; a corrupt row falls
      // back to the default rather than taking the app down.
      try {
        settings[row.key] = coerce(row.key, row.value) as never;
      } catch {
        /* keep the default */
      }
    }
    return settings;
  }

  /** Reads one switch without loading the rest (hot paths like registration). */
  async isRegistrationOpen(): Promise<boolean> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: "registrationOpen" },
      select: { value: true },
    });
    if (!row) return DEFAULT_SETTINGS.registrationOpen;
    return coerce("registrationOpen", row.value) as boolean;
  }

  async isMaintenanceMode(): Promise<boolean> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: "maintenanceMode" },
      select: { value: true },
    });
    if (!row) return DEFAULT_SETTINGS.maintenanceMode;
    return coerce("maintenanceMode", row.value) as boolean;
  }

  /**
   * Validates then upserts. Validation lives here rather than in a DTO so it
   * applies to every caller of `set`, and it is what keeps junk out of a key
   * the rest of the app reads as a typed value.
   */
  async set(
    key: string,
    value: unknown,
    updatedBy: string | null,
  ): Promise<PlatformSettings> {
    if (!isSettingKey(key)) {
      throw new BadRequestException(
        `Unknown setting "${key}". Known keys: ${SETTING_KEYS.join(", ")}.`,
      );
    }
    const validated = validate(key, value);

    await this.prisma.platformSetting.upsert({
      where: { key },
      update: {
        value: validated as Prisma.InputJsonValue,
        updatedBy,
      },
      create: {
        key,
        value: validated as Prisma.InputJsonValue,
        updatedBy,
      },
    });

    return this.get();
  }
}

function coerce(key: SettingKey, raw: unknown): PlatformSettings[SettingKey] {
  if (key === "disabledCategories") {
    const list = Array.isArray(raw) ? raw : [];
    return list.filter((v): v is CategoryId =>
      CATEGORY_IDS.includes(v as CategoryId),
    );
  }
  return Boolean(raw);
}

function validate(key: SettingKey, value: unknown): PlatformSettings[SettingKey] {
  if (key === "disabledCategories") {
    if (!Array.isArray(value)) {
      throw new BadRequestException("disabledCategories must be an array of category ids.");
    }
    const invalid = value.filter(
      (v) => typeof v !== "string" || !CATEGORY_IDS.includes(v as CategoryId),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown categories: ${invalid.join(", ")}. Valid: ${CATEGORY_IDS.join(", ")}.`,
      );
    }
    // A request that disables everything would make the app unusable, so at
    // least one category must stay reachable.
    if (value.length >= CATEGORY_IDS.length) {
      throw new BadRequestException("At least one category must stay enabled.");
    }
    return [...new Set(value as CategoryId[])];
  }

  if (typeof value !== "boolean") {
    throw new BadRequestException(`${key} must be true or false.`);
  }
  return value;
}

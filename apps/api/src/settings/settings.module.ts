import { Global, Module } from "@nestjs/common";

import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

/**
 * `@Global()` so auth, rooms and admin can each inject SettingsService
 * without importing this module (and without the import cycle that would
 * create: AdminModule already imports AuthModule for its guard).
 */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

import { Controller, Get } from "@nestjs/common";

import { SettingsService, type PlatformSettings } from "./settings.service";

/**
 * Public read of the switches the client has to know about: which categories
 * are switched off, whether the app is in maintenance, whether sign-up is
 * open. All three are safe to expose - each one only tells a visitor what the
 * UI is allowed to offer them. Nothing else from platform_settings ever
 * leaves the admin surface.
 */
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get(): Promise<PlatformSettings> {
    return this.settings.get();
  }
}

import { MockSettingsService } from "./services/mock-settings-service";
import type { SettingsService } from "./services/settings-service";

export const settingsService: SettingsService = new MockSettingsService();

import { applicationServices } from "../service-composition";
import type { SettingsService } from "./services/settings-service";

export const settingsService: SettingsService = applicationServices.settingsService;

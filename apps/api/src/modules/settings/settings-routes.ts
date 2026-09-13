import { Router, type RequestHandler } from "express";

import type { PostgresDatabase } from "../../database/index.js";
import {
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createSettingsController } from "./settings-controller.js";
import { PostgresSettingsRepository } from "./settings-repository.js";
import { SettingsService } from "./settings-service.js";

export function createSettingsRouter(options: Readonly<{
  database: PostgresDatabase;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const controller = createSettingsController(
    new SettingsService(new PostgresSettingsRepository(options.database)),
  );
  const router = Router();

  router.get(
    "/staff/settings",
    options.authenticate,
    requireStaff(),
    requirePermission("settings.manage"),
    controller.get,
  );
  router.put(
    "/staff/settings",
    options.authenticate,
    requireStaff(),
    requirePermission("settings.manage"),
    options.csrf,
    controller.update,
  );
  return router;
}

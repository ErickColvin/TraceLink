import { Router, type RequestHandler } from "express";

import type { AppConfig } from "../../config/env.js";
import type { PostgresDatabase } from "../../database/index.js";
import {
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createInventoryController } from "./inventory-controller.js";
import { InventoryService } from "./inventory-service.js";

export function createInventoryRouter(options: Readonly<{
  database: PostgresDatabase;
  config: AppConfig;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const controller = createInventoryController(
    new InventoryService(options.database, options.config.idempotencySecret),
  );
  const router = Router();
  const read = [
    options.authenticate,
    requireStaff(),
    requirePermission("inventory.view"),
  ] as const;

  router.get("/staff/inventory/categories", ...read, controller.listCategories);
  router.get("/staff/inventory/movements", ...read, controller.listMovements);
  router.post(
    "/staff/inventory/movements",
    options.authenticate,
    requireStaff(),
    requirePermission("inventory.adjust"),
    options.csrf,
    controller.createMovement,
  );
  router.get("/staff/inventory/:id", ...read, controller.getById);
  router.get("/staff/inventory", ...read, controller.list);
  return router;
}

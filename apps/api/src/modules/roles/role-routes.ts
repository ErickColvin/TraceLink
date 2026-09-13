import { Router, type RequestHandler } from "express";

import type { PostgresDatabase } from "../../database/index.js";
import {
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createRoleController } from "./role-controller.js";
import { PostgresRoleRepository } from "./role-repository.js";
import { RoleService } from "./role-service.js";

export function createRoleRouter(options: Readonly<{
  database: PostgresDatabase;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const controller = createRoleController(
    new RoleService(new PostgresRoleRepository(options.database)),
  );
  const router = Router();
  const readAccess = [
    options.authenticate,
    requireStaff(),
    requirePermission("users.view"),
  ] as const;

  router.get("/staff/roles", ...readAccess, controller.list);
  router.get("/staff/roles/:id", ...readAccess, controller.getById);
  router.put(
    "/staff/roles/:id/permissions",
    options.authenticate,
    requireStaff(),
    requirePermission("users.manage"),
    options.csrf,
    controller.updatePermissions,
  );
  return router;
}

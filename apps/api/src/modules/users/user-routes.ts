import { Router, type RequestHandler } from "express";

import type { PostgresDatabase } from "../../database/index.js";
import {
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createUserController } from "./user-controller.js";
import { PostgresUserRepository } from "./user-repository.js";
import { UserService } from "./user-service.js";

export function createUserRouter(options: Readonly<{
  database: PostgresDatabase;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const controller = createUserController(
    new UserService(new PostgresUserRepository(options.database)),
  );
  const router = Router();
  const readAccess = [
    options.authenticate,
    requireStaff(),
    requirePermission("users.view"),
  ] as const;

  router.get("/staff/users", ...readAccess, controller.list);
  router.get("/staff/users/:id", ...readAccess, controller.getById);
  router.patch(
    "/staff/users/:id/access",
    options.authenticate,
    requireStaff(),
    requirePermission("users.manage"),
    options.csrf,
    controller.updateAccess,
  );
  return router;
}

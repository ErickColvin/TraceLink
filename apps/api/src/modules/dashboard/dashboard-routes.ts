import { Router, type RequestHandler } from "express";

import type { PostgresDatabase } from "../../database/index.js";
import { requireStaff } from "../../middleware/authenticate.js";
import { createDashboardController } from "./dashboard-controller.js";
import { PostgresDashboardRepository } from "./dashboard-repository.js";
import { DashboardService } from "./dashboard-service.js";

export function createDashboardRouter(options: Readonly<{
  database: PostgresDatabase;
  authenticate: RequestHandler;
}>): Router {
  const controller = createDashboardController(
    new DashboardService(new PostgresDashboardRepository(options.database)),
  );
  const router = Router();

  // There is deliberately no dashboard.view key in the current 19-permission
  // catalog. Any active staff membership may read its own tenant overview.
  router.get(
    "/staff/dashboard",
    options.authenticate,
    requireStaff(),
    controller.getOverview,
  );
  return router;
}

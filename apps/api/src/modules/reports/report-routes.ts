import { Router, type RequestHandler } from "express";

import type { PostgresDatabase } from "../../database/index.js";
import {
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createReportController } from "./report-controller.js";
import { PostgresReportRepository } from "./report-repository.js";
import { ReportService } from "./report-service.js";

export function createReportRouter(options: Readonly<{
  database: PostgresDatabase;
  authenticate: RequestHandler;
}>): Router {
  const controller = createReportController(
    new ReportService(new PostgresReportRepository(options.database)),
  );
  const router = Router();

  router.get(
    "/staff/reports",
    options.authenticate,
    requireStaff(),
    requirePermission("reports.view"),
    controller.list,
  );
  return router;
}

import { Router, type RequestHandler } from "express";

import type { AppConfig } from "../../config/env.js";
import type { PostgresDatabase } from "../../database/index.js";
import {
  requireCustomer,
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createOrderController } from "./order-controller.js";
import { OrderService } from "./order-service.js";

export function createOrderRouter(options: Readonly<{
  database: PostgresDatabase;
  config: AppConfig;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const controller = createOrderController(
    new OrderService(options.database, options.config.idempotencySecret),
  );
  const router = Router();
  const customerRead = [options.authenticate, requireCustomer()] as const;
  const staffRead = [
    options.authenticate,
    requireStaff(),
    requirePermission("orders.view"),
  ] as const;

  router.get("/me/orders", ...customerRead, controller.listCurrentCustomer);
  router.get(
    "/me/orders/:id",
    ...customerRead,
    controller.getCurrentCustomerById,
  );
  router.post(
    "/staff/orders/:id/transitions",
    options.authenticate,
    requireStaff(),
    requirePermission("orders.update"),
    options.csrf,
    controller.transitionStatus,
  );
  router.post(
    "/staff/orders/:id/cancellation",
    options.authenticate,
    requireStaff(),
    requirePermission("orders.cancel"),
    options.csrf,
    controller.cancel,
  );
  router.get("/staff/orders/:id", ...staffRead, controller.getStaffById);
  router.get("/staff/orders", ...staffRead, controller.listStaff);
  return router;
}

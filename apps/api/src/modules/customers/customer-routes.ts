import { Router, type RequestHandler } from "express";

import type { PostgresDatabase } from "../../database/index.js";
import {
  requireCustomer,
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createCustomerController } from "./customer-controller.js";
import { PostgresCustomerRepository } from "./customer-repository.js";
import { CustomerService } from "./customer-service.js";

export function createCustomerRouter(options: Readonly<{
  database: PostgresDatabase;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const controller = createCustomerController(
    new CustomerService(new PostgresCustomerRepository(options.database)),
  );
  const router = Router();

  router.get(
    "/me/profile",
    options.authenticate,
    requireCustomer(),
    controller.getCurrent,
  );
  router.patch(
    "/me/profile",
    options.authenticate,
    requireCustomer(),
    options.csrf,
    controller.updateCurrent,
  );
  router.get(
    "/staff/customers",
    options.authenticate,
    requireStaff(),
    requirePermission("customers.view"),
    controller.listStaff,
  );
  router.get(
    "/staff/customers/:id",
    options.authenticate,
    requireStaff(),
    requirePermission("customers.view"),
    controller.getStaffDetail,
  );
  router.patch(
    "/staff/customers/:id",
    options.authenticate,
    requireStaff(),
    requirePermission("customers.update"),
    options.csrf,
    controller.updateStaff,
  );
  return router;
}

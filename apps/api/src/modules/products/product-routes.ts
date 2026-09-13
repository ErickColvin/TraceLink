import { Router, type RequestHandler } from "express";

import type { AppConfig } from "../../config/env.js";
import type { PostgresDatabase } from "../../database/index.js";
import {
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createProductController } from "./product-controller.js";
import { PostgresProductRepository } from "./product-repository.js";
import { ProductService } from "./product-service.js";

export function createProductRouter(options: Readonly<{
  database: PostgresDatabase;
  config: AppConfig;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const service = new ProductService(
    new PostgresProductRepository(options.database),
    options.config.organizationSlug,
  );
  const controller = createProductController(service);
  const router = Router();
  const staffRead = [
    options.authenticate,
    requireStaff(),
    requirePermission("products.view"),
  ] as const;

  router.get("/products/categories", controller.listCategories);
  router.get("/products/:slug/related", controller.listRelated);
  router.get("/products/:slug", controller.getPublicBySlug);
  router.get("/products", controller.listPublic);

  router.get("/staff/products", ...staffRead, controller.listStaff);
  router.get("/staff/products/:id", ...staffRead, controller.getStaffById);
  router.post(
    "/staff/products",
    options.authenticate,
    requireStaff(),
    requirePermission("products.create"),
    options.csrf,
    controller.create,
  );
  router.patch(
    "/staff/products/:id",
    options.authenticate,
    requireStaff(),
    requirePermission("products.update"),
    options.csrf,
    controller.update,
  );
  router.patch(
    "/staff/products/:id/active",
    options.authenticate,
    requireStaff(),
    requirePermission("products.update"),
    options.csrf,
    controller.setActive,
  );
  router.patch(
    "/staff/products/:id/publication",
    options.authenticate,
    requireStaff(),
    requirePermission("products.update"),
    options.csrf,
    controller.setPublished,
  );
  return router;
}

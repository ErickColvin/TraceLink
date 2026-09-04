import { Router, type RequestHandler } from "express";

import type { AppConfig } from "../../config/env.js";
import type { PostgresDatabase } from "../../database/index.js";
import {
  getAuthContext,
  requireCustomer,
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { PersistentRateLimiter } from "../../middleware/rate-limit.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createPackageController } from "./package-controller.js";
import { PackageService } from "./package-service.js";

function createDeliveryRateLimit(limiter: PersistentRateLimiter): RequestHandler {
  return async (request, response, next) => {
    try {
      const auth = getAuthContext(request);
      const packageId = request.params["id"] ?? "invalid";
      const outcome = await limiter.consume({
        scope: "package.delivery",
        key: `${auth.organization.id}\0${auth.user.id}\0${packageId}\0${request.ip}`,
        maxAttempts: 5,
        windowSeconds: 15 * 60,
        blockSeconds: 15 * 60,
      });
      if (!outcome.allowed) {
        response.setHeader("Retry-After", outcome.retryAfterSeconds ?? 1);
        throw new AppError({
          statusCode: 429,
          code: "RATE_LIMITED",
          message: "Demasiados intentos de entrega. Intenta nuevamente más tarde.",
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createPackageRouter(options: Readonly<{
  database: PostgresDatabase;
  config: AppConfig;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const controller = createPackageController(
    new PackageService({
      database: options.database,
      idempotencySecret: options.config.idempotencySecret,
      pickupCodeSecret: options.config.pickupCodeSecret,
    }),
  );
  const deliveryRateLimit = createDeliveryRateLimit(
    new PersistentRateLimiter(options.database, options.config.rateLimitSecret),
  );
  const router = Router();

  router.get(
    "/me/packages",
    options.authenticate,
    requireCustomer(),
    controller.listCurrentCustomer,
  );
  router.get(
    "/me/packages/:id",
    options.authenticate,
    requireCustomer(),
    controller.getCurrentCustomerById,
  );
  router.get(
    "/staff/package-customer-options",
    options.authenticate,
    requireStaff(),
    requirePermission("packages.receive"),
    controller.listCustomerOptions,
  );
  router.get(
    "/staff/packages",
    options.authenticate,
    requireStaff(),
    requirePermission("packages.view"),
    controller.listStaff,
  );
  router.get(
    "/staff/packages/:id",
    options.authenticate,
    requireStaff(),
    requirePermission("packages.view"),
    controller.getStaffById,
  );
  router.post(
    "/staff/packages",
    options.authenticate,
    requireStaff(),
    requirePermission("packages.receive"),
    options.csrf,
    controller.receive,
  );
  router.post(
    "/staff/packages/:id/transitions",
    options.authenticate,
    requireStaff(),
    requirePermission("packages.update"),
    options.csrf,
    controller.transition,
  );
  router.post(
    "/staff/packages/:id/delivery",
    options.authenticate,
    requireStaff(),
    requirePermission("packages.deliver"),
    options.csrf,
    deliveryRateLimit,
    controller.deliver,
  );
  return router;
}

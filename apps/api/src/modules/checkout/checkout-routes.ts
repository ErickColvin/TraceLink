import { Router, type RequestHandler } from "express";

import type { AppConfig } from "../../config/env.js";
import type { PostgresDatabase } from "../../database/index.js";
import { requireCustomer } from "../../middleware/authenticate.js";
import type { PaymentProvider } from "../payments/payment-provider.js";
import { createCheckoutController } from "./checkout-controller.js";
import { CheckoutService } from "./checkout-service.js";

export function createCheckoutRouter(options: Readonly<{
  database: PostgresDatabase;
  config: AppConfig;
  provider: PaymentProvider;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const router = Router();
  const service = new CheckoutService({
    database: options.database,
    idempotencySecret: options.config.idempotencySecret,
    provider: options.provider,
    reservationMinutes: options.config.checkoutReservationMinutes,
  });
  router.post(
    "/checkout",
    options.authenticate,
    requireCustomer(),
    options.csrf,
    createCheckoutController(service),
  );
  return router;
}


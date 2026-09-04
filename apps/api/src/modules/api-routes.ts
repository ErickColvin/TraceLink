import { Router } from "express";

import type { AppConfig } from "../config/env.js";
import type { PostgresDatabase } from "../database/index.js";
import { createAuthenticate } from "../middleware/authenticate.js";
import { requireCsrf } from "../middleware/csrf.js";
import { PostgresAuthRepository } from "./auth/auth-repository.js";
import { createCustomerRouter } from "./customers/customer-routes.js";
import { createInventoryRouter } from "./inventory/inventory-routes.js";
import { createOrderRouter } from "./orders/order-routes.js";
import { createPackageRouter } from "./packages/package-routes.js";
import { createProductRouter } from "./products/product-routes.js";

export function createApiRouter(options: Readonly<{
  database: PostgresDatabase;
  config: AppConfig;
}>): Router {
  const router = Router();
  const authRepository = new PostgresAuthRepository(options.database);
  const authenticate = createAuthenticate({
    repository: authRepository,
    sessionSecret: options.config.sessionSecret,
    sessionIdleTtlSeconds: options.config.sessionIdleTtlSeconds,
    nodeEnv: options.config.nodeEnv,
  });
  const csrf = requireCsrf(options.config.csrfSecret);

  router.use(
    createProductRouter({
      database: options.database,
      config: options.config,
      authenticate,
      csrf,
    }),
  );
  router.use(
    createCustomerRouter({ database: options.database, authenticate, csrf }),
  );
  router.use(
    createInventoryRouter({
      database: options.database,
      config: options.config,
      authenticate,
      csrf,
    }),
  );
  router.use(
    createOrderRouter({
      database: options.database,
      config: options.config,
      authenticate,
      csrf,
    }),
  );
  router.use(
    createPackageRouter({
      database: options.database,
      config: options.config,
      authenticate,
      csrf,
    }),
  );
  return router;
}

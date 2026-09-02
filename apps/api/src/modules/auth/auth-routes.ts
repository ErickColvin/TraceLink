import { Router } from "express";

import type { AppConfig } from "../../config/env.js";
import type { PostgresDatabase } from "../../database/index.js";
import { createAuthenticate } from "../../middleware/authenticate.js";
import { requireCsrf } from "../../middleware/csrf.js";
import {
  createAuthRateLimit,
  PersistentRateLimiter,
} from "../../middleware/rate-limit.js";
import { createAuthController } from "./auth-controller.js";
import { PostgresAuthRepository } from "./auth-repository.js";
import { AuthService } from "./auth-service.js";

export function createAuthRouter(options: Readonly<{
  database: PostgresDatabase;
  config: AppConfig;
}>): Router {
  const repository = new PostgresAuthRepository(options.database);
  const service = new AuthService({
    repository,
    organizationSlug: options.config.organizationSlug,
    sessionSecret: options.config.sessionSecret,
    csrfSecret: options.config.csrfSecret,
    sessionTtlSeconds: options.config.sessionTtlSeconds,
  });
  const controller = createAuthController(service, options.config);
  const limiter = new PersistentRateLimiter(
    options.database,
    options.config.rateLimitSecret,
  );
  const authenticate = createAuthenticate({
    repository,
    sessionSecret: options.config.sessionSecret,
    sessionIdleTtlSeconds: options.config.sessionIdleTtlSeconds,
    nodeEnv: options.config.nodeEnv,
  });
  const csrf = requireCsrf(options.config.csrfSecret);
  const router = Router();

  router.post(
    "/login",
    createAuthRateLimit({ limiter, scope: "auth.login" }),
    controller.login,
  );
  router.post(
    "/register",
    createAuthRateLimit({ limiter, scope: "auth.register", maxAttempts: 3 }),
    controller.register,
  );
  router.get("/me", authenticate, controller.me);
  router.post("/logout", authenticate, csrf, controller.logout);

  return router;
}


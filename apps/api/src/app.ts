import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Logger } from "pino";

import type { AppConfig } from "./config/env.js";
import type { PostgresDatabase } from "./database/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import {
  createHealthRouter,
  type ReadinessCheck,
} from "./modules/health/health-routes.js";
import { createAuthRouter } from "./modules/auth/auth-routes.js";
import { createLogger, createRequestLogger } from "./shared/logging/logger.js";
import {
  enforceMutationOrigin,
  isAllowedOrigin,
} from "./shared/security/origin.js";

export type CreateAppOptions = Readonly<{
  config: AppConfig;
  logger?: Logger;
  readinessCheck?: ReadinessCheck;
  database?: PostgresDatabase;
}>;

const unavailableReadinessCheck: ReadinessCheck = async () => {
  throw new Error("Database readiness probe is not configured.");
};

export function createApp(options: CreateAppOptions): Express {
  const { config } = options;
  const logger = options.logger ?? createLogger(config);
  const readinessCheck =
    options.readinessCheck ?? unavailableReadinessCheck;
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(requestIdMiddleware);
  app.use(createRequestLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (origin === undefined) {
          callback(null, false);
          return;
        }

        if (isAllowedOrigin(origin, config.webOrigin)) {
          callback(null, origin);
          return;
        }

        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "X-CSRF-Token",
        "Idempotency-Key",
        "X-Request-ID",
      ],
      exposedHeaders: [
        "X-Request-ID",
        "Idempotency-Replayed",
        "Retry-After",
      ],
      maxAge: 600,
      optionsSuccessStatus: 204,
    }),
  );
  app.use(enforceMutationOrigin(config.webOrigin));
  app.use(
    express.json({
      limit: `${config.jsonBodyLimitBytes}b`,
      strict: true,
      type: ["application/json", "application/*+json"],
    }),
  );

  app.use("/api/v1/health", createHealthRouter(readinessCheck));
  if (options.database !== undefined) {
    app.use(
      "/api/v1/auth",
      createAuthRouter({ database: options.database, config }),
    );
  }
  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return app;
}

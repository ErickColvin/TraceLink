import { loadEnvironment } from "../config/env.js";
import { createPostgresDatabase } from "../database/index.js";
import { createNotificationProvider } from "../modules/notifications/notification-provider-factory.js";
import { NotificationOutboxProcessor } from "../modules/notifications/notification-outbox.js";
import { createLogger } from "../shared/logging/logger.js";

async function main(): Promise<void> {
  const config = loadEnvironment();
  const logger = createLogger(config);
  const database = createPostgresDatabase({
    databaseUrl: config.databaseUrl,
    max: Math.min(config.databasePoolMax, 2),
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
  });

  try {
    const processor = new NotificationOutboxProcessor(
      database,
      createNotificationProvider(config),
    );
    const result = await processor.process({
      limit: 50,
      leaseMinutes: 10,
      onFailure: ({ eventId, eventType, attempt, code, terminal, error }) => {
        logger.error({
          err: error,
          event: "notification.delivery.failed",
          eventId,
          eventType,
          attempt,
          code,
          terminal,
        });
      },
    });
    logger.info({ event: "notification.outbox.completed", ...result });
    if (result.retrying > 0 || result.dead > 0) process.exitCode = 1;
  } finally {
    await database.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`Notification outbox failed: ${message}\n`);
  process.exitCode = 1;
});

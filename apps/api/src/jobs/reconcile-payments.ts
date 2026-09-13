import { loadEnvironment } from "../config/env.js";
import { createPostgresDatabase } from "../database/index.js";
import { createPaymentProvider } from "../modules/payments/payment-provider-factory.js";
import { PaymentReconciliationJob } from "../modules/payments/payment-reconciliation-job.js";
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
    const job = new PaymentReconciliationJob(
      database,
      createPaymentProvider(config),
    );
    const result = await job.run({
      limit: 50,
      minAgeMinutes: 2,
      maxAgeHours: 72,
      onFailure: ({ paymentId, providerOrderId, requestId, error }) => {
        logger.error({
          err: error,
          event: "payment.reconciliation.failed",
          paymentId,
          providerOrderId,
          requestId,
        });
      },
    });
    logger.info({ event: "payment.reconciliation.completed", ...result });
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await database.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`Payment reconciliation failed: ${message}\n`);
  process.exitCode = 1;
});

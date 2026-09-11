import { randomUUID } from "node:crypto";

import { loadEnvironment } from "../config/env.js";
import { createPostgresDatabase } from "../database/index.js";
import { InventoryReservationService } from "../modules/inventory/inventory-reservation-service.js";
import { createLogger } from "../shared/logging/logger.js";

type OrganizationRow = Readonly<{ id: string }>;

async function main(): Promise<void> {
  const config = loadEnvironment();
  const logger = createLogger(config);
  const database = createPostgresDatabase({
    databaseUrl: config.databaseUrl,
    max: Math.min(config.databasePoolMax, 2),
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
  });
  let total = 0;
  try {
    const organizations = await database.query<OrganizationRow>(
      "SELECT id FROM organizations WHERE active = true ORDER BY id ASC",
    );
    const service = new InventoryReservationService(database);
    for (const organization of organizations.rows) {
      let count: number;
      do {
        const expired = await service.expireDue({
          organizationId: organization.id,
          requestId: `reservation-expiry-job-${randomUUID()}`,
          limit: 100,
        });
        count = expired.length;
        total += count;
      } while (count === 100);
    }
    logger.info({
      event: "reservation.expiry.completed",
      expiredReservations: total,
    });
  } finally {
    await database.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Reservation expiration failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});

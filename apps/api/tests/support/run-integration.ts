import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import EmbeddedPostgres from "embedded-postgres";

import { runWithCleanup } from "./runner-lifecycle.js";
import { verifySeedDataset } from "./verify-seed.js";

async function findAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null
    ? address.port
    : 0;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  if (port === 0) throw new Error("Could not reserve a PostgreSQL test port.");
  return port;
}

async function runNode(
  entrypoint: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with ${code ?? signal ?? "unknown"}.`));
    });
  });
}

async function expectNodeFailure(
  entrypoint: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  expectedMessage: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: environment,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        reject(new Error("Expected command to fail, but it completed successfully."));
        return;
      }
      if (!stderr.includes(expectedMessage)) {
        reject(
          new Error(
            `Command failed with ${code ?? signal ?? "unknown"}, but did not report the expected reason: ${stderr}`,
          ),
        );
        return;
      }
      resolve();
    });
  });
}

function packageEntrypoint(packageName: string, relativePath: string): string {
  const packageJson = fileURLToPath(import.meta.resolve(`${packageName}/package.json`));
  return join(dirname(packageJson), relativePath);
}

async function main(): Promise<void> {
  const port = await findAvailablePort();
  const databaseDir = await mkdtemp(join(tmpdir(), "tracelink-pg18-"));
  const user = "tracelink_test";
  const password = `test-${crypto.randomUUID()}`;
  const databaseName = "tracelink_test";
  const bootstrapDatabaseName = "tracelink_bootstrap_test";
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => undefined,
    onError: () => undefined,
  });

  await runWithCleanup(
    async () => {
      await postgres.initialise();
      await postgres.start();
      await postgres.createDatabase(databaseName);
      await postgres.createDatabase(bootstrapDatabaseName);
      const databaseUrl =
        `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
        `@127.0.0.1:${port}/${databaseName}?schema=public`;
      const bootstrapDatabaseUrl =
        `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
        `@127.0.0.1:${port}/${bootstrapDatabaseName}?schema=public`;
      const environment = {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: databaseUrl,
        PICKUP_CODE_SECRET: "integration-pickup-code-secret-32-characters",
        SEED_ADMIN_EMAIL: "admin@chmarket.test",
        SEED_ADMIN_PASSWORD: "Admin-Test-Password-123!",
        SEED_STAFF_EMAIL: "staff@chmarket.test",
        SEED_STAFF_PASSWORD: "Staff-Test-Password-123!",
        SEED_CUSTOMER_EMAIL: "seed-customer@chmarket.test",
        SEED_CUSTOMER_PASSWORD: "Customer-Test-Password-123!",
        SEED_PACKAGE_PICKUP_CODE: "Integration-Pickup-Code-42",
      } satisfies NodeJS.ProcessEnv;
      const bootstrapEnvironment = {
        ...process.env,
        NODE_ENV: "production",
        APP_ENV: "production",
        DATABASE_URL: bootstrapDatabaseUrl,
        BOOTSTRAP_CONFIRM: "CREATE_CH_MARKET",
        BOOTSTRAP_ADMIN_EMAIL: "owner-bootstrap@chmarket.test",
        BOOTSTRAP_ADMIN_PASSWORD: "Bootstrap-Test-Password-123!",
        BOOTSTRAP_ADMIN_FIRST_NAME: "Owner",
        BOOTSTRAP_ADMIN_LAST_NAME: "CH Market",
        BOOTSTRAP_CONTACT_EMAIL: "contact-bootstrap@chmarket.test",
        BOOTSTRAP_CONTACT_PHONE: "+56912345678",
        BOOTSTRAP_PICKUP_ADDRESS: "Dirección de retiro para integración",
        BOOTSTRAP_PICKUP_INSTRUCTIONS: "Presentar identificación al retirar.",
        BOOTSTRAP_LOW_STOCK_THRESHOLD: "5",
        BOOTSTRAP_PACKAGE_ALERT_DAYS: "5",
        BOOTSTRAP_EXPIRATION_WARNING_DAYS: "30",
      } satisfies NodeJS.ProcessEnv;

      await runNode(
        packageEntrypoint("prisma", "dist/prisma.js"),
        ["db", "migrate", "--advance-ref", "db"],
        bootstrapEnvironment,
      );
      const tsxEntrypoint = packageEntrypoint("tsx", "dist/cli.mjs");
      await runNode(
        tsxEntrypoint,
        ["src/jobs/bootstrap-production.ts"],
        bootstrapEnvironment,
      );
      await runNode(
        tsxEntrypoint,
        ["tests/support/verify-production-bootstrap.ts"],
        bootstrapEnvironment,
      );
      await expectNodeFailure(
        tsxEntrypoint,
        ["src/jobs/bootstrap-production.ts"],
        bootstrapEnvironment,
        "El bootstrap es de un solo uso",
      );
      await runNode(
        tsxEntrypoint,
        ["tests/support/verify-production-bootstrap.ts"],
        bootstrapEnvironment,
      );

      await runNode(
        packageEntrypoint("prisma", "dist/prisma.js"),
        ["db", "migrate", "--advance-ref", "db"],
        environment,
      );
      await runNode(
        packageEntrypoint("prisma", "dist/prisma.js"),
        ["db", "verify"],
        environment,
      );
      await runNode(
        packageEntrypoint("tsx", "dist/cli.mjs"),
        ["prisma/seed.ts"],
        environment,
      );
      await runNode(
        packageEntrypoint("tsx", "dist/cli.mjs"),
        ["prisma/seed.ts"],
        environment,
      );
      await verifySeedDataset({
        adminEmail: environment.SEED_ADMIN_EMAIL,
        databaseUrl,
        customerEmail: environment.SEED_CUSTOMER_EMAIL,
        packagePickupCode: environment.SEED_PACKAGE_PICKUP_CODE,
        pickupCodeSecret: environment.PICKUP_CODE_SECRET,
        staffEmail: environment.SEED_STAFF_EMAIL,
      });
      await runNode(
        packageEntrypoint("vitest", "vitest.mjs"),
        ["run", "--config", "vitest.integration.config.ts"],
        environment,
      );
    },
    [{ label: "PostgreSQL embebido", run: () => postgres.stop() }],
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Integration runner failed."}\n`,
  );
  process.exitCode = 1;
});

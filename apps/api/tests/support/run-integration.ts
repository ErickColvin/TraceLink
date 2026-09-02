import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import EmbeddedPostgres from "embedded-postgres";

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

  try {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase(databaseName);
    const databaseUrl =
      `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
      `@127.0.0.1:${port}/${databaseName}?schema=public`;
    const environment = {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      TEST_DATABASE_URL: databaseUrl,
      SEED_ADMIN_EMAIL: "admin@chmarket.test",
      SEED_ADMIN_PASSWORD: "Admin-Test-Password-123!",
    } satisfies NodeJS.ProcessEnv;

    await runNode(
      packageEntrypoint("prisma", "dist/prisma.js"),
      ["db", "migrate", "--advance-ref", "db"],
      environment,
    );
    await runNode(
      packageEntrypoint("tsx", "dist/cli.mjs"),
      ["prisma/seed.ts"],
      environment,
    );
    await runNode(
      packageEntrypoint("vitest", "vitest.mjs"),
      ["run", "--config", "vitest.integration.config.ts"],
      environment,
    );
  } finally {
    await postgres.stop().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Integration runner failed."}\n`,
  );
  process.exitCode = 1;
});

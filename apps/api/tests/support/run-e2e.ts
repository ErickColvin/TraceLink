import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createServer, type Server as NetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import EmbeddedPostgres from "embedded-postgres";

import { parseEnvironment } from "../../src/config/env.js";
import { createPostgresDatabase } from "../../src/database/index.js";
import { startServer } from "../../src/server.js";
import {
  HTTP_E2E_FIXTURES,
  seedHttpE2eFixtures,
} from "../e2e/seed-http-e2e-fixtures.js";
import {
  createChildFailurePromise,
  runWithCleanup,
  stopChild,
} from "./runner-lifecycle.js";

const apiRoot = fileURLToPath(new URL("../..", import.meta.url));
const repositoryRoot = resolve(apiRoot, "../..");

async function closePortReservation(server: NetServer): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolvePromise, reject) => {
    server.close((error) => (error === undefined ? resolvePromise() : reject(error)));
  });
}

async function closePortReservations(servers: readonly NetServer[]): Promise<void> {
  const outcomes = await Promise.allSettled(servers.map(closePortReservation));
  const failures = outcomes
    .filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected")
    .map((outcome) => outcome.reason);
  if (failures.length > 0) {
    throw new AggregateError(failures, "No se pudieron liberar todas las reservas de puertos E2E.");
  }
}

async function findAvailablePorts(): Promise<readonly [number, number, number]> {
  const reservations: NetServer[] = [];
  const ports = await runWithCleanup(
    async () => {
      const availablePorts: number[] = [];
      for (let index = 0; index < 3; index += 1) {
        const server = createServer();
        reservations.push(server);
        await new Promise<void>((resolvePromise, reject) => {
          server.once("error", reject);
          server.listen(0, "127.0.0.1", resolvePromise);
        });
        const address = server.address();
        if (typeof address !== "object" || address === null || address.port === 0) {
          throw new Error("No se pudo reservar un puerto E2E.");
        }
        availablePorts.push(address.port);
      }
      return availablePorts;
    },
    [
      {
        label: "reservas de puertos E2E",
        run: () => closePortReservations(reservations),
      },
    ],
  );

  const [postgresPort, apiPort, webPort] = ports;
  if (postgresPort === undefined || apiPort === undefined || webPort === undefined) {
    throw new Error("No se pudieron reservar los tres puertos E2E.");
  }
  return [postgresPort, apiPort, webPort];
}

function packageEntrypoint(packageName: string, relativePath: string): string {
  const packageJson = fileURLToPath(import.meta.resolve(`${packageName}/package.json`));
  return join(dirname(packageJson), relativePath);
}

async function runNode(
  entrypoint: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  cwd = apiRoot,
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else {
        reject(
          new Error(
            `El comando ${entrypoint} terminó con ${code ?? signal ?? "estado desconocido"}.`,
          ),
        );
      }
    });
  });
}

async function waitForUrl(url: string, label: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok) return;
      lastError = new Error(`${label} respondió HTTP ${response.status}.`);
    } catch (error: unknown) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`${label} no quedó disponible.`, { cause: lastError });
}

function startVite(
  port: number,
  environment: NodeJS.ProcessEnv,
): Readonly<{
  child: ChildProcess;
  failure: Promise<never>;
  logs: () => string;
}> {
  const viteEntrypoint = join(
    repositoryRoot,
    "apps",
    "web",
    "node_modules",
    "vite",
    "bin",
    "vite.js",
  );
  if (!existsSync(viteEntrypoint)) {
    throw new Error("Vite no está instalado. Ejecuta pnpm install antes de test:e2e.");
  }
  let output = "";
  const child = spawn(
    process.execPath,
    [viteEntrypoint, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: join(repositoryRoot, "apps", "web"),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const collect = (chunk: Buffer) => {
    output = `${output}${chunk.toString("utf8")}`.slice(-8_000);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  const logs = () => output;
  return {
    child,
    failure: createChildFailurePromise(child, "Vite", logs),
    logs,
  };
}

type ProcessSignal = "SIGINT" | "SIGTERM";

function captureSignalListeners(): ReadonlyMap<
  ProcessSignal,
  ReadonlySet<NodeJS.SignalsListener>
> {
  return new Map<ProcessSignal, ReadonlySet<NodeJS.SignalsListener>>([
    ["SIGINT", new Set(process.listeners("SIGINT"))],
    ["SIGTERM", new Set(process.listeners("SIGTERM"))],
  ]);
}

function removeAddedSignalListeners(
  originalListeners: ReadonlyMap<
    ProcessSignal,
    ReadonlySet<NodeJS.SignalsListener>
  >,
): void {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const original =
      originalListeners.get(signal) ?? new Set<NodeJS.SignalsListener>();
    for (const listener of process.listeners(signal)) {
      if (!original.has(listener)) process.removeListener(signal, listener);
    }
  }
}

async function main(): Promise<void> {
  const [postgresPort, apiPort, webPort] = await findAvailablePorts();
  const databaseDir = await mkdtemp(join(tmpdir(), "tracelink-e2e-pg18-"));
  const databaseUser = "tracelink_e2e";
  const databasePassword = `e2e-${crypto.randomUUID()}`;
  const databaseName = "tracelink_e2e";
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: databaseUser,
    password: databasePassword,
    port: postgresPort,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  let vite: ReturnType<typeof startVite> | undefined;
  let runningApi: Awaited<ReturnType<typeof startServer>> | undefined;
  let database: ReturnType<typeof createPostgresDatabase> | undefined;
  const originalSignalListeners = captureSignalListeners();

  await runWithCleanup(
    async () => {
      try {
        await postgres.initialise();
        await postgres.start();
        await postgres.createDatabase(databaseName);
        const databaseUrl =
          `postgresql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}` +
          `@127.0.0.1:${postgresPort}/${databaseName}?schema=public`;
        const webOrigin = `http://127.0.0.1:${webPort}`;
        const apiOrigin = `http://127.0.0.1:${apiPort}`;
        const environment = {
          ...process.env,
          NODE_ENV: "test",
          HOST: "127.0.0.1",
          PORT: String(apiPort),
          DATABASE_URL: databaseUrl,
          TEST_DATABASE_URL: databaseUrl,
          WEB_ORIGIN: webOrigin,
          ORGANIZATION_SLUG: "ch-market",
          SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
          SESSION_TTL_SECONDS: "28800",
          SESSION_IDLE_TTL_SECONDS: "1800",
          CSRF_SECRET: "e2e-csrf-secret-with-at-least-32-characters",
          IDEMPOTENCY_SECRET: "e2e-idempotency-secret-with-at-least-32-characters",
          RATE_LIMIT_SECRET: "e2e-rate-limit-secret-with-at-least-32-characters",
          PICKUP_CODE_SECRET: "e2e-pickup-code-secret-with-at-least-32-characters",
          LOG_LEVEL: "silent",
          SEED_ADMIN_EMAIL: "admin@chmarket.test",
          SEED_ADMIN_PASSWORD: "Test-Phase3-Admin!42",
          SEED_STAFF_EMAIL: "staff@chmarket.test",
          SEED_STAFF_PASSWORD: "Test-Phase3-Admin!42",
          SEED_CUSTOMER_EMAIL: HTTP_E2E_FIXTURES.customerEmail,
          SEED_CUSTOMER_PASSWORD: HTTP_E2E_FIXTURES.customerPassword,
          SEED_PACKAGE_PICKUP_CODE: "Demo-Pickup-Code-42",
        } satisfies NodeJS.ProcessEnv;

        process.stdout.write(
          "[E2E] Aplicando migraciones en PostgreSQL 18 embebido...\n",
        );
        await runNode(
          packageEntrypoint("prisma", "dist/prisma.js"),
          ["db", "migrate", "--advance-ref", "db"],
          environment,
        );
        process.stdout.write("[E2E] Ejecutando seed y fixtures aislados...\n");
        await runNode(
          packageEntrypoint("tsx", "dist/cli.mjs"),
          ["prisma/seed.ts"],
          environment,
        );
        database = createPostgresDatabase({ databaseUrl });
        await seedHttpE2eFixtures(database);

        runningApi = await startServer({
          config: parseEnvironment(environment),
          database,
        });
        await waitForUrl(`${apiOrigin}/api/v1/health/ready`, "La API");

        vite = startVite(webPort, {
          ...process.env,
          NODE_ENV: "test",
          VITE_DATA_MODE: "http",
          VITE_API_BASE_URL: "/api/v1",
          VITE_API_PROXY_TARGET: apiOrigin,
        });
        await Promise.race([
          waitForUrl(webOrigin, "El frontend Vite"),
          vite.failure,
        ]);

        process.stdout.write("[E2E] Ejecutando recorridos Playwright contra HTTP real...\n");
        await Promise.race([
          runNode(
            join(repositoryRoot, "tests", "e2e", "http-real.e2e.mjs"),
            [],
            {
              ...process.env,
              NODE_ENV: "test",
              TRACELINK_E2E_URL: webOrigin,
              TRACELINK_E2E_ADMIN_EMAIL: environment.SEED_ADMIN_EMAIL,
              TRACELINK_E2E_ADMIN_PASSWORD: environment.SEED_ADMIN_PASSWORD,
              TRACELINK_E2E_CUSTOMER_EMAIL: environment.SEED_CUSTOMER_EMAIL,
              TRACELINK_E2E_CUSTOMER_PASSWORD: environment.SEED_CUSTOMER_PASSWORD,
            },
            repositoryRoot,
          ),
          vite.failure,
        ]);
        process.stdout.write("[E2E] Recorridos HTTP reales completados.\n");
      } catch (error: unknown) {
        if (vite?.logs()) process.stderr.write(`\n--- Vite E2E ---\n${vite.logs()}\n`);
        throw error;
      }
    },
    [
      { label: "Vite", run: () => stopChild(vite?.child) },
      {
        label: "servidor API",
        run: async () => {
          await runningApi?.shutdown("e2e-complete");
        },
      },
      {
        label: "pool PostgreSQL de la API",
        run: async () => {
          await database?.close();
        },
      },
      {
        label: "listeners de señales",
        run: () => removeAddedSignalListeners(originalSignalListeners),
      },
      { label: "PostgreSQL embebido", run: () => postgres.stop() },
    ],
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error
    ? error.stack ?? error.message
    : "El runner E2E falló sin detalle.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

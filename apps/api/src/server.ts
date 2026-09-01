import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";

import type { Logger } from "pino";

import { createApp } from "./app.js";
import { loadEnvironment, type AppConfig } from "./config/env.js";
import type { ReadinessCheck } from "./modules/health/health-routes.js";
import { createLogger } from "./shared/logging/logger.js";

export type StartServerOptions = Readonly<{
  config?: AppConfig;
  logger?: Logger;
  readinessCheck?: ReadinessCheck;
  onShutdown?: () => Promise<void>;
}>;

export type RunningServer = Readonly<{
  server: Server;
  shutdown: (reason?: string) => Promise<void>;
}>;

async function listen(server: Server, config: AppConfig): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(config.port, config.host);
  });
}

async function closeServer(server: Server, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(forceCloseTimer);
      if (error) reject(error);
      else resolve();
    };
    const forceCloseTimer = setTimeout(() => {
      server.closeAllConnections();
      finish();
    }, timeoutMs);
    forceCloseTimer.unref();

    server.close((error) => finish(error));
    server.closeIdleConnections();
  });
}

export async function startServer(
  options: StartServerOptions = {},
): Promise<RunningServer> {
  const config = options.config ?? loadEnvironment();
  const logger = options.logger ?? createLogger(config);
  const appOptions = {
    config,
    logger,
    ...(options.readinessCheck === undefined
      ? {}
      : { readinessCheck: options.readinessCheck }),
  };
  const server = createServer(createApp(appOptions));
  let shutdownPromise: Promise<void> | undefined;

  const performShutdown = async (reason: string) => {
    logger.info({ reason }, "Graceful shutdown started");
    await closeServer(server, config.shutdownTimeoutMs);
    await options.onShutdown?.();
    logger.info({ reason }, "Graceful shutdown completed");
  };

  const shutdown = (reason = "manual") => {
    shutdownPromise ??= performShutdown(reason);
    return shutdownPromise;
  };

  const handleSignal = (signal: NodeJS.Signals) => {
    void shutdown(signal).catch((error: unknown) => {
      logger.error({ err: error, signal }, "Graceful shutdown failed");
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  await listen(server, config);
  logger.info(
    { host: config.host, port: config.port },
    "TraceLink API is listening",
  );

  return { server, shutdown };
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isMainModule()) {
  void startServer().catch((error: unknown) => {
    const fallbackLogger = createLogger({
      nodeEnv: "production",
      logLevel: "error",
    });
    fallbackLogger.fatal({ err: error }, "TraceLink API failed to start");
    process.exitCode = 1;
  });
}

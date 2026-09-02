import type { AppConfig } from "../../src/config/env.js";

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return Object.freeze({
    nodeEnv: "test",
    host: "127.0.0.1",
    port: 3001,
    trustProxy: false,
    databaseUrl: "postgresql://tracelink:test@127.0.0.1:5433/tracelink_test",
    webOrigin: "http://127.0.0.1:5173",
    organizationSlug: "ch-market",
    sessionSecret: "session-secret-for-tests-only-32-chars",
    sessionTtlSeconds: 28_800,
    sessionIdleTtlSeconds: 1_800,
    csrfSecret: "csrf-secret-for-tests-only-32-chars---",
    idempotencySecret: "idempotency-secret-for-tests-only-32",
    rateLimitSecret: "rate-limit-secret-for-tests-only-32--",
    pickupCodeSecret: "pickup-code-secret-for-tests-only-32-",
    logLevel: "silent",
    jsonBodyLimitBytes: 1_024,
    shutdownTimeoutMs: 1_000,
    ...overrides,
  });
}

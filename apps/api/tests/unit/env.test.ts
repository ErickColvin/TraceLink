import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  parseEnvironment,
} from "../../src/config/env.js";

const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://tracelink:test@127.0.0.1:5433/tracelink_test",
  WEB_ORIGIN: "http://127.0.0.1:5173",
  SESSION_SECRET: "session-secret-for-tests-only-32-chars",
  CSRF_SECRET: "csrf-secret-for-tests-only-32-chars---",
} as const;

describe("parseEnvironment", () => {
  it("normalizes an exact web origin and applies bounded defaults", () => {
    const config = parseEnvironment(validEnvironment);

    expect(config.webOrigin).toBe("http://127.0.0.1:5173");
    expect(config.port).toBe(3001);
    expect(config.jsonBodyLimitBytes).toBe(102_400);
    expect(config.shutdownTimeoutMs).toBe(10_000);
  });

  it("rejects web origins with paths", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        WEB_ORIGIN: "http://127.0.0.1:5173/app",
      }),
    ).toThrow(EnvironmentValidationError);
  });

  it("reports invalid fields without echoing secret values", () => {
    const secret = "too-short";

    try {
      parseEnvironment({ ...validEnvironment, SESSION_SECRET: secret });
      throw new Error("Expected parseEnvironment to reject the secret.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      expect(String(error)).toContain("SESSION_SECRET");
      expect(String(error)).not.toContain(secret);
    }
  });
});

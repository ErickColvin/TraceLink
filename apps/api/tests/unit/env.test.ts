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
  IDEMPOTENCY_SECRET: "idempotency-secret-for-tests-only-32",
  RATE_LIMIT_SECRET: "rate-limit-secret-for-tests-only-32--",
  PICKUP_CODE_SECRET: "pickup-code-secret-for-tests-only-32-",
} as const;

describe("parseEnvironment", () => {
  it("normalizes an exact web origin and applies bounded defaults", () => {
    const config = parseEnvironment(validEnvironment);

    expect(config.webOrigin).toBe("http://127.0.0.1:5173");
    expect(config.port).toBe(3001);
    expect(config.organizationSlug).toBe("ch-market");
    expect(config.trustProxy).toBe(false);
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

  it("accepts only explicit proxy hop, IP, or CIDR configurations", () => {
    expect(parseEnvironment({ ...validEnvironment, TRUST_PROXY: "1" }).trustProxy)
      .toBe(1);
    expect(
      parseEnvironment({
        ...validEnvironment,
        TRUST_PROXY: "127.0.0.1, 10.0.0.0/8, 2001:db8::/32",
      }).trustProxy,
    ).toEqual(["127.0.0.1", "10.0.0.0/8", "2001:db8::/32"]);
  });

  it.each([
    "true",
    "0",
    "proxy.internal",
    "0.0.0.0/0",
    "::/0",
    "10.0.0.0/99",
    "1.2.3.999",
  ])(
    "rejects unsafe or invalid TRUST_PROXY=%s",
    (trustProxy) => {
      expect(() =>
        parseEnvironment({ ...validEnvironment, TRUST_PROXY: trustProxy }),
      ).toThrow(EnvironmentValidationError);
    },
  );

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

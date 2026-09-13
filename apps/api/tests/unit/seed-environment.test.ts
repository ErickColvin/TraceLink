import { describe, expect, it } from "vitest";

import {
  parseSeedEnvironment,
  SeedEnvironmentValidationError,
} from "../../prisma/seed-environment.js";

const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://seed:test@127.0.0.1:1/unreachable",
  PICKUP_CODE_SECRET: "seed-pickup-code-secret-for-tests-32-chars",
  SEED_ADMIN_EMAIL: "seed-admin@chmarket.test",
  SEED_ADMIN_PASSWORD: "Seed-Admin-Password-123!",
  SEED_STAFF_EMAIL: "seed-staff@chmarket.test",
  SEED_STAFF_PASSWORD: "Seed-Staff-Password-123!",
  SEED_CUSTOMER_EMAIL: "seed-customer@chmarket.test",
  SEED_CUSTOMER_PASSWORD: "Seed-Customer-Password-123!",
  SEED_PACKAGE_PICKUP_CODE: "Seed-Pickup-Code-42",
} as const;

describe("parseSeedEnvironment", () => {
  it.each(["development", "test"] as const)(
    "accepts custom values in %s",
    (nodeEnvironment) => {
      expect(
        parseSeedEnvironment({
          ...validEnvironment,
          NODE_ENV: nodeEnvironment,
        }).NODE_ENV,
      ).toBe(nodeEnvironment);
    },
  );

  it.each([
    ["NODE_ENV", "production"],
    [
      "DATABASE_URL",
      "postgresql://tracelink:replace-with-a-local-only-password@127.0.0.1:5432/tracelink?schema=public",
    ],
    ["PICKUP_CODE_SECRET", "replace-with-base64-pickup-code-secret-at-least-32-bytes"],
    ["SEED_ADMIN_EMAIL", "admin@example.invalid"],
    ["SEED_ADMIN_PASSWORD", "replace-before-seeding"],
    ["SEED_STAFF_EMAIL", "staff@example.invalid"],
    ["SEED_STAFF_PASSWORD", "replace-before-seeding"],
    ["SEED_CUSTOMER_EMAIL", "customer@example.invalid"],
    ["SEED_CUSTOMER_PASSWORD", "replace-before-seeding"],
    ["SEED_PACKAGE_PICKUP_CODE", "replace-before-seeding"],
  ] as const)("rejects unsafe %s without echoing its value", (field, value) => {
    let captured: unknown;
    try {
      parseSeedEnvironment({ ...validEnvironment, [field]: value });
    } catch (error: unknown) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(SeedEnvironmentValidationError);
    expect((captured as SeedEnvironmentValidationError).fields).toContain(field);
    expect(String(captured)).not.toContain(value);
  });

  it("requires an explicit NODE_ENV before any database work", () => {
    expect(() =>
      parseSeedEnvironment({ ...validEnvironment, NODE_ENV: undefined }),
    ).toThrow(SeedEnvironmentValidationError);
  });

  it("preserves the separate-password fallback contract", () => {
    const parsed = parseSeedEnvironment({
      ...validEnvironment,
      SEED_STAFF_PASSWORD: undefined,
      SEED_CUSTOMER_PASSWORD: undefined,
    });
    expect(parsed.SEED_STAFF_PASSWORD).toBeUndefined();
    expect(parsed.SEED_CUSTOMER_PASSWORD).toBeUndefined();
  });
});

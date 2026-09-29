import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseStagingInitEnvironment,
  StagingInitEnvironmentError,
} from "../../src/config/staging-init-env.js";
import { initializeStaging } from "../../src/modules/staging/staging-initialization.js";
import { stagingInitEnvironment } from "../support/staging-init-environment.js";

const valid = stagingInitEnvironment("postgresql://127.0.0.1:1/not_connected");

describe("staging initialization gates", () => {
  it("accepts explicit staging/fake configuration without an admin", () => {
    const parsed = parseStagingInitEnvironment(valid);
    expect(parsed.APP_ENV).toBe("staging");
    expect(parsed.STAGING_ADMIN_EMAIL).toBeUndefined();
    expect(parsed.STAGING_ADMIN_PASSWORD).toBeUndefined();
  });

  it.each([
    ["APP_ENV", "production"], ["APP_ENV", "local"], ["APP_ENV", undefined],
    ["NODE_ENV", "development"], ["NODE_ENV", "test"], ["NODE_ENV", undefined],
    ["PAYMENT_PROVIDER", "mercadopago"], ["PAYMENT_PROVIDER", undefined],
    ["EMAIL_PROVIDER", "resend"], ["EMAIL_PROVIDER", undefined],
    ["STAGING_INIT_CONFIRM", undefined], ["STAGING_INIT_CONFIRM", "CREATE_CH_MARKET"],
    ["RAILWAY_ENVIRONMENT_NAME", "production"], ["ORGANIZATION_SLUG", "other-tenant"],
    ["DATABASE_URL", "https://example.invalid"], ["STAGING_CONTACT_EMAIL", undefined],
  ])("rejects invalid %s (%s) before DB connection", async (field, value) => {
    const environment = { ...valid, [field ?? ""]: value };
    expect(() => parseStagingInitEnvironment(environment)).toThrow(StagingInitEnvironmentError);
    await expect(initializeStaging(environment)).rejects.toBeInstanceOf(StagingInitEnvironmentError);
  });

  it("does not accept production confirmation in place of staging confirmation", () => {
    expect(() => parseStagingInitEnvironment({
      ...valid, STAGING_INIT_CONFIRM: undefined, BOOTSTRAP_CONFIRM: "CREATE_CH_MARKET",
    })).toThrow(StagingInitEnvironmentError);
  });

  it("requires both admin variables or neither and rejects empty/short passwords", () => {
    const password = randomBytes(32).toString("base64url");
    for (const admin of [
      { STAGING_ADMIN_EMAIL: "admin@example.invalid" },
      { STAGING_ADMIN_PASSWORD: password },
      { STAGING_ADMIN_EMAIL: "admin@example.invalid", STAGING_ADMIN_PASSWORD: "" },
      { STAGING_ADMIN_EMAIL: "admin@example.invalid", STAGING_ADMIN_PASSWORD: randomBytes(4).toString("hex") },
    ]) {
      expect(() => parseStagingInitEnvironment({ ...valid, ...admin })).toThrow(StagingInitEnvironmentError);
    }
    const parsed = parseStagingInitEnvironment({
      ...valid, STAGING_ADMIN_EMAIL: " Admin@EXAMPLE.INVALID ", STAGING_ADMIN_PASSWORD: password,
    });
    expect(parsed.STAGING_ADMIN_EMAIL).toBe("admin@example.invalid");
    expect(parsed.STAGING_ADMIN_PASSWORD === password).toBe(true);
  });

  it("reports field names only, never password or connection credentials", () => {
    const secret = randomBytes(12).toString("hex");
    const environment = {
      ...valid, APP_ENV: secret, DATABASE_URL: secret,
      STAGING_ADMIN_PASSWORD: secret, STAGING_ADMIN_EMAIL: secret,
    };
    try {
      parseStagingInitEnvironment(environment);
      throw new Error("Expected gate rejection.");
    } catch (error) {
      expect(error).toBeInstanceOf(StagingInitEnvironmentError);
      const output = `${String(error)} ${JSON.stringify(error)}`;
      expect(output.includes(secret)).toBe(false);
      expect(output).toContain("STAGING_INIT_ENV_INVALID");
    }
  });
});

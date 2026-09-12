import { describe, expect, it } from "vitest";

import {
  parseProductionBootstrapEnvironment,
  ProductionBootstrapEnvironmentError,
} from "../../src/config/bootstrap-env.js";

const valid = {
  NODE_ENV: "production",
  APP_ENV: "production",
  DATABASE_URL: "postgresql://service:secret@db.internal/tracelink",
  BOOTSTRAP_CONFIRM: "CREATE_CH_MARKET",
  BOOTSTRAP_ADMIN_EMAIL: "owner@example.com",
  BOOTSTRAP_ADMIN_PASSWORD: "Secure-Bootstrap-Password-123!",
  BOOTSTRAP_ADMIN_FIRST_NAME: "Owner",
  BOOTSTRAP_ADMIN_LAST_NAME: "CH Market",
  BOOTSTRAP_CONTACT_EMAIL: "contact@example.com",
  BOOTSTRAP_CONTACT_PHONE: "+56912345678",
  BOOTSTRAP_PICKUP_ADDRESS: "Dirección comercial aprobada",
  BOOTSTRAP_PICKUP_INSTRUCTIONS: "Instrucciones operativas aprobadas",
  BOOTSTRAP_LOW_STOCK_THRESHOLD: "5",
  BOOTSTRAP_PACKAGE_ALERT_DAYS: "5",
  BOOTSTRAP_EXPIRATION_WARNING_DAYS: "30",
} as const;

describe("production bootstrap environment", () => {
  it("requires an explicit production-only confirmation", () => {
    expect(parseProductionBootstrapEnvironment(valid)).toMatchObject({
      BOOTSTRAP_CONFIRM: "CREATE_CH_MARKET",
      BOOTSTRAP_LOW_STOCK_THRESHOLD: 5,
    });
    expect(() => parseProductionBootstrapEnvironment({
      ...valid,
      BOOTSTRAP_CONFIRM: "yes",
    })).toThrow(ProductionBootstrapEnvironmentError);
  });

  it("rejects development and documented weak passwords", () => {
    expect(() => parseProductionBootstrapEnvironment({
      ...valid,
      NODE_ENV: "development",
    })).toThrow(ProductionBootstrapEnvironmentError);
    expect(() => parseProductionBootstrapEnvironment({
      ...valid,
      BOOTSTRAP_ADMIN_PASSWORD: "replace-before-seeding",
    })).toThrow(ProductionBootstrapEnvironmentError);
  });
});

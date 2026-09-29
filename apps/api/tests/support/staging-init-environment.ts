import { randomBytes } from "node:crypto";

/** Only used with disposable test databases; never used by the runtime initializer. */
export function stagingInitEnvironment(databaseUrl: string, withAdmin = false): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    APP_ENV: "staging",
    PAYMENT_PROVIDER: "fake",
    EMAIL_PROVIDER: "fake",
    STAGING_INIT_CONFIRM: "INIT_CH_MARKET",
    RAILWAY_ENVIRONMENT_NAME: "staging",
    ORGANIZATION_SLUG: "ch-market",
    DATABASE_URL: databaseUrl,
    STAGING_CONTACT_EMAIL: "contact@staging.example.invalid",
    STAGING_CONTACT_PHONE: "000000",
    STAGING_PICKUP_ADDRESS: "Isolated integration test location",
    STAGING_PICKUP_INSTRUCTIONS: "Integration tests only; no real pickups.",
    ...(withAdmin ? {
      STAGING_ADMIN_EMAIL: "admin@staging.example.invalid",
      STAGING_ADMIN_PASSWORD: randomBytes(32).toString("base64url"),
    } : {}),
  };
}

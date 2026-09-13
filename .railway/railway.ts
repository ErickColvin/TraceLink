import {
  defineRailway,
  empty,
  github,
  group,
  postgres,
  preserve,
  project,
  service,
} from "railway/iac";

const REPOSITORY = "ErickColvin/TraceLink";
const BUILD_COMMAND =
  "corepack pnpm install --frozen-lockfile && corepack pnpm --filter @tracelink/contracts build && corepack pnpm --filter @tracelink/api build";

export default defineRailway((context) => {
  const appEnvironment = context.isEnvironment("production")
    ? "production"
    : "staging";
  const source = appEnvironment === "production"
    ? empty()
    : github(REPOSITORY, { branch: "main", checkSuites: true });
  const database = postgres("tracelink-postgres");

  const api = service("tracelink-api", {
    source,
    build: BUILD_COMMAND,
    start: "corepack pnpm --filter @tracelink/api start",
    preDeploy: "corepack pnpm db:migrate",
    healthcheck: "/api/v1/health/ready",
    healthcheckTimeout: 120,
    replicas: 1,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
      overlapSeconds: 30,
      drainingSeconds: 15,
    },
    env: {
      NODE_ENV: "production",
      APP_ENV: appEnvironment,
      HOST: "0.0.0.0",
      DATABASE_URL: database.env.DATABASE_URL,
      DATABASE_POOL_MAX: "10",
      DATABASE_CONNECTION_TIMEOUT_MS: "10000",
      DATABASE_IDLE_TIMEOUT_MS: "30000",
      TRUST_PROXY: "1",
      LOG_LEVEL: "info",
      ORGANIZATION_SLUG: "ch-market",
      WEB_ORIGIN: preserve(),
      API_PUBLIC_URL: preserve(),
      SESSION_SECRET: preserve(),
      SESSION_COOKIE_SAME_SITE: "none",
      CSRF_SECRET: preserve(),
      IDEMPOTENCY_SECRET: preserve(),
      RATE_LIMIT_SECRET: preserve(),
      PICKUP_CODE_SECRET: preserve(),
      EMAIL_PROVIDER: "fake",
      EMAIL_FROM: preserve(),
      EMAIL_REPLY_TO: preserve(),
      RESEND_API_KEY: preserve(),
      STAFF_NOTIFICATION_EMAIL: preserve(),
      PAYMENT_PROVIDER: "fake",
      MERCADOPAGO_ACCESS_TOKEN: preserve(),
      MERCADOPAGO_WEBHOOK_SECRET: preserve(),
      PAYMENT_SUCCESS_URL: preserve(),
      PAYMENT_FAILURE_URL: preserve(),
      PAYMENT_PENDING_URL: preserve(),
      PAYMENT_WEBHOOK_URL: preserve(),
    },
  });

  const reservationExpiry = service("reservation-expiry", {
    source,
    build: BUILD_COMMAND,
    start: "node apps/api/dist/jobs/expire-reservations.js",
    deploy: {
      cronSchedule: "*/5 * * * *",
      restartPolicyType: "NEVER",
    },
    env: {
      NODE_ENV: api.env.NODE_ENV,
      APP_ENV: api.env.APP_ENV,
      HOST: api.env.HOST,
      DATABASE_URL: database.env.DATABASE_URL,
      DATABASE_POOL_MAX: "2",
      DATABASE_CONNECTION_TIMEOUT_MS: api.env.DATABASE_CONNECTION_TIMEOUT_MS,
      DATABASE_IDLE_TIMEOUT_MS: api.env.DATABASE_IDLE_TIMEOUT_MS,
      TRUST_PROXY: api.env.TRUST_PROXY,
      LOG_LEVEL: api.env.LOG_LEVEL,
      ORGANIZATION_SLUG: api.env.ORGANIZATION_SLUG,
      WEB_ORIGIN: api.env.WEB_ORIGIN,
      API_PUBLIC_URL: api.env.API_PUBLIC_URL,
      SESSION_SECRET: api.env.SESSION_SECRET,
      CSRF_SECRET: api.env.CSRF_SECRET,
      IDEMPOTENCY_SECRET: api.env.IDEMPOTENCY_SECRET,
      RATE_LIMIT_SECRET: api.env.RATE_LIMIT_SECRET,
      PICKUP_CODE_SECRET: api.env.PICKUP_CODE_SECRET,
      PAYMENT_PROVIDER: api.env.PAYMENT_PROVIDER,
      MERCADOPAGO_ACCESS_TOKEN: api.env.MERCADOPAGO_ACCESS_TOKEN,
      MERCADOPAGO_WEBHOOK_SECRET: api.env.MERCADOPAGO_WEBHOOK_SECRET,
      PAYMENT_SUCCESS_URL: api.env.PAYMENT_SUCCESS_URL,
      PAYMENT_FAILURE_URL: api.env.PAYMENT_FAILURE_URL,
      PAYMENT_PENDING_URL: api.env.PAYMENT_PENDING_URL,
      PAYMENT_WEBHOOK_URL: api.env.PAYMENT_WEBHOOK_URL,
    },
  });

  const paymentReconciliation = service("payment-reconciliation", {
    source,
    build: BUILD_COMMAND,
    start: "node apps/api/dist/jobs/reconcile-payments.js",
    deploy: {
      cronSchedule: "*/5 * * * *",
      restartPolicyType: "NEVER",
    },
    env: {
      NODE_ENV: api.env.NODE_ENV,
      APP_ENV: api.env.APP_ENV,
      HOST: api.env.HOST,
      DATABASE_URL: database.env.DATABASE_URL,
      DATABASE_POOL_MAX: "2",
      DATABASE_CONNECTION_TIMEOUT_MS: api.env.DATABASE_CONNECTION_TIMEOUT_MS,
      DATABASE_IDLE_TIMEOUT_MS: api.env.DATABASE_IDLE_TIMEOUT_MS,
      TRUST_PROXY: api.env.TRUST_PROXY,
      LOG_LEVEL: api.env.LOG_LEVEL,
      ORGANIZATION_SLUG: api.env.ORGANIZATION_SLUG,
      WEB_ORIGIN: api.env.WEB_ORIGIN,
      API_PUBLIC_URL: api.env.API_PUBLIC_URL,
      SESSION_SECRET: api.env.SESSION_SECRET,
      CSRF_SECRET: api.env.CSRF_SECRET,
      IDEMPOTENCY_SECRET: api.env.IDEMPOTENCY_SECRET,
      RATE_LIMIT_SECRET: api.env.RATE_LIMIT_SECRET,
      PICKUP_CODE_SECRET: api.env.PICKUP_CODE_SECRET,
      PAYMENT_PROVIDER: api.env.PAYMENT_PROVIDER,
      MERCADOPAGO_ACCESS_TOKEN: api.env.MERCADOPAGO_ACCESS_TOKEN,
      MERCADOPAGO_WEBHOOK_SECRET: api.env.MERCADOPAGO_WEBHOOK_SECRET,
      PAYMENT_SUCCESS_URL: api.env.PAYMENT_SUCCESS_URL,
      PAYMENT_FAILURE_URL: api.env.PAYMENT_FAILURE_URL,
      PAYMENT_PENDING_URL: api.env.PAYMENT_PENDING_URL,
      PAYMENT_WEBHOOK_URL: api.env.PAYMENT_WEBHOOK_URL,
    },
  });

  const notificationOutbox = service("notification-outbox", {
    source,
    build: BUILD_COMMAND,
    start: "node apps/api/dist/jobs/process-notification-outbox.js",
    deploy: {
      cronSchedule: "*/5 * * * *",
      restartPolicyType: "NEVER",
    },
    env: {
      NODE_ENV: api.env.NODE_ENV,
      APP_ENV: api.env.APP_ENV,
      HOST: api.env.HOST,
      DATABASE_URL: database.env.DATABASE_URL,
      DATABASE_POOL_MAX: "2",
      DATABASE_CONNECTION_TIMEOUT_MS: api.env.DATABASE_CONNECTION_TIMEOUT_MS,
      DATABASE_IDLE_TIMEOUT_MS: api.env.DATABASE_IDLE_TIMEOUT_MS,
      TRUST_PROXY: api.env.TRUST_PROXY,
      LOG_LEVEL: api.env.LOG_LEVEL,
      ORGANIZATION_SLUG: api.env.ORGANIZATION_SLUG,
      WEB_ORIGIN: api.env.WEB_ORIGIN,
      API_PUBLIC_URL: api.env.API_PUBLIC_URL,
      SESSION_SECRET: api.env.SESSION_SECRET,
      CSRF_SECRET: api.env.CSRF_SECRET,
      IDEMPOTENCY_SECRET: api.env.IDEMPOTENCY_SECRET,
      RATE_LIMIT_SECRET: api.env.RATE_LIMIT_SECRET,
      PICKUP_CODE_SECRET: api.env.PICKUP_CODE_SECRET,
      PAYMENT_PROVIDER: api.env.PAYMENT_PROVIDER,
      MERCADOPAGO_ACCESS_TOKEN: api.env.MERCADOPAGO_ACCESS_TOKEN,
      MERCADOPAGO_WEBHOOK_SECRET: api.env.MERCADOPAGO_WEBHOOK_SECRET,
      PAYMENT_SUCCESS_URL: api.env.PAYMENT_SUCCESS_URL,
      PAYMENT_FAILURE_URL: api.env.PAYMENT_FAILURE_URL,
      PAYMENT_PENDING_URL: api.env.PAYMENT_PENDING_URL,
      PAYMENT_WEBHOOK_URL: api.env.PAYMENT_WEBHOOK_URL,
      EMAIL_PROVIDER: api.env.EMAIL_PROVIDER,
      EMAIL_FROM: api.env.EMAIL_FROM,
      EMAIL_REPLY_TO: api.env.EMAIL_REPLY_TO,
      RESEND_API_KEY: api.env.RESEND_API_KEY,
      STAFF_NOTIFICATION_EMAIL: api.env.STAFF_NOTIFICATION_EMAIL,
    },
  });

  return project("TraceLink", {
    environments: ["staging", "production"],
    resources: [
      ...group("Data", [database], { color: "#7c3aed" }),
      ...group("Application", [api], { color: "#2563eb" }),
      ...group("Scheduled jobs", [
        reservationExpiry,
        paymentReconciliation,
        notificationOutbox,
      ], {
        color: "#059669",
      }),
    ],
  });
});

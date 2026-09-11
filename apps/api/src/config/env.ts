import { isIP } from "node:net";

import { z } from "zod";

const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;
const APP_ENVIRONMENTS = ["local", "staging", "production"] as const;
const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;
const EMAIL_PROVIDERS = ["fake", "resend"] as const;

const webOriginSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.username === "" &&
        url.password === "" &&
        url.pathname === "/" &&
        url.search === "" &&
        url.hash === ""
      );
    } catch {
      return false;
    }
  }, "WEB_ORIGIN debe ser un origen HTTP(S) sin ruta, credenciales, query ni hash.")
  .transform((value) => new URL(value).origin);

const databaseUrlSchema = z.string().trim().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}, "DATABASE_URL debe ser una URL PostgreSQL válida.");

const paymentUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//iu.test(value), {
    message: "La URL de pagos debe usar HTTP(S).",
  });

const publicUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.username === "" &&
        url.password === "" &&
        url.pathname === "/" &&
        url.search === "" &&
        url.hash === ""
      );
    } catch {
      return false;
    }
  }, "La URL pública debe ser un origen HTTP(S) sin ruta, credenciales, query ni hash.")
  .transform((value) => new URL(value).origin);

export type TrustProxyConfig = false | number | readonly string[];

function isIpOrCidr(value: string): boolean {
  const separator = value.lastIndexOf("/");
  const address = separator === -1 ? value : value.slice(0, separator);
  const version = isIP(address);
  if (version === 0) return false;
  if (separator === -1) return true;

  const prefix = value.slice(separator + 1);
  if (!/^\d+$/.test(prefix)) return false;
  const bits = Number(prefix);
  return bits >= 1 && bits <= (version === 4 ? 32 : 128);
}

const trustProxyEnvironmentSchema = z
  .string()
  .trim()
  .default("false")
  .transform((value, context): TrustProxyConfig => {
    if (value === "false") return false;

    if (/^\d+$/.test(value)) {
      const hops = Number(value);
      if (hops >= 1 && hops <= 255) return hops;
    } else {
      const addresses = value.split(",").map((entry) => entry.trim());
      if (
        addresses.length > 0 &&
        addresses.length <= 32 &&
        addresses.every((entry) => isIpOrCidr(entry))
      ) {
        return Object.freeze(addresses);
      }
    }

    context.addIssue({
      code: "custom",
      message:
        "TRUST_PROXY debe ser false, un número de saltos o una lista de IP/CIDR explícita.",
    });
    return z.NEVER;
  });

const rawEnvironmentSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default("development"),
  APP_ENV: z.enum(APP_ENVIRONMENTS).optional(),
  HOST: z.string().trim().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  TRUST_PROXY: trustProxyEnvironmentSchema,
  DATABASE_URL: databaseUrlSchema,
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(10_000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(30_000),
  WEB_ORIGIN: webOriginSchema,
  API_PUBLIC_URL: publicUrlSchema.optional(),
  ORGANIZATION_SLUG: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80)
    .default("ch-market"),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(2_592_000)
    .default(28_800),
  SESSION_IDLE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(86_400)
    .default(1_800),
  CSRF_SECRET: z.string().min(32),
  IDEMPOTENCY_SECRET: z.string().min(32),
  RATE_LIMIT_SECRET: z.string().min(32),
  PICKUP_CODE_SECRET: z.string().min(32),
  EMAIL_PROVIDER: z.enum(EMAIL_PROVIDERS).default("fake"),
  EMAIL_FROM: z.string().trim().email().optional(),
  EMAIL_REPLY_TO: z.string().trim().email().optional(),
  RESEND_API_KEY: z.string().trim().min(1).max(512).optional(),
  STAFF_NOTIFICATION_EMAIL: z.string().trim().email().optional(),
  PAYMENT_PROVIDER: z.enum(["fake", "mercadopago"]).optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().trim().min(1).max(2_048).optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().trim().min(1).max(512).optional(),
  PAYMENT_SUCCESS_URL: paymentUrlSchema.optional(),
  PAYMENT_FAILURE_URL: paymentUrlSchema.optional(),
  PAYMENT_PENDING_URL: paymentUrlSchema.optional(),
  PAYMENT_WEBHOOK_URL: paymentUrlSchema.optional(),
  CHECKOUT_RESERVATION_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(15),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  JSON_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(1_048_576)
    .default(102_400),
  SHUTDOWN_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(10_000),
  SEED_ADMIN_EMAIL: z.string().trim().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
}).superRefine((value, context) => {
  const appEnv = value.APP_ENV ??
    (value.NODE_ENV === "production" ? "production" : "local");

  if (appEnv !== "local" && value.NODE_ENV !== "production") {
    context.addIssue({
      code: "custom",
      path: ["NODE_ENV"],
      message: "Staging y producción deben ejecutar NODE_ENV=production.",
    });
  }
  if (appEnv !== "local" && value.API_PUBLIC_URL === undefined) {
    context.addIssue({
      code: "custom",
      path: ["API_PUBLIC_URL"],
      message: "API_PUBLIC_URL es obligatorio fuera del entorno local.",
    });
  }
  if (appEnv !== "local") {
    const secureUrls = [
      ["WEB_ORIGIN", value.WEB_ORIGIN],
      ["API_PUBLIC_URL", value.API_PUBLIC_URL],
    ] as const;
    for (const [field, url] of secureUrls) {
      if (url !== undefined && !url.startsWith("https://")) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} debe usar HTTPS fuera del entorno local.`,
        });
      }
    }
  }
  if (value.SESSION_IDLE_TTL_SECONDS > value.SESSION_TTL_SECONDS) {
    context.addIssue({
      code: "custom",
      path: ["SESSION_IDLE_TTL_SECONDS"],
      message: "SESSION_IDLE_TTL_SECONDS no puede superar SESSION_TTL_SECONDS.",
    });
  }
  if (value.NODE_ENV === "production" && value.PAYMENT_PROVIDER === undefined) {
    context.addIssue({
      code: "custom",
      path: ["PAYMENT_PROVIDER"],
      message: "PAYMENT_PROVIDER debe configurarse explÃ­citamente en producciÃ³n.",
    });
  }
  if (value.PAYMENT_PROVIDER === "mercadopago") {
    const requiredFields = [
      "MERCADOPAGO_ACCESS_TOKEN",
      "MERCADOPAGO_WEBHOOK_SECRET",
      "PAYMENT_SUCCESS_URL",
      "PAYMENT_FAILURE_URL",
      "PAYMENT_PENDING_URL",
      "PAYMENT_WEBHOOK_URL",
    ] as const;
    for (const field of requiredFields) {
      if (value[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} es obligatorio con Mercado Pago.`,
        });
      }
    }
  }
  if (value.EMAIL_PROVIDER === "resend") {
    for (const field of ["EMAIL_FROM", "RESEND_API_KEY"] as const) {
      if (value[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} es obligatorio con Resend.`,
        });
      }
    }
  }
});

export type AppConfig = Readonly<{
  nodeEnv: (typeof NODE_ENVIRONMENTS)[number];
  appEnv: (typeof APP_ENVIRONMENTS)[number];
  host: string;
  port: number;
  trustProxy: TrustProxyConfig;
  databaseUrl: string;
  databasePoolMax: number;
  databaseConnectionTimeoutMs: number;
  databaseIdleTimeoutMs: number;
  webOrigin: string;
  apiPublicUrl: string;
  organizationSlug: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  sessionIdleTtlSeconds: number;
  csrfSecret: string;
  idempotencySecret: string;
  rateLimitSecret: string;
  pickupCodeSecret: string;
  emailProvider: (typeof EMAIL_PROVIDERS)[number];
  emailFrom?: string;
  emailReplyTo?: string;
  resendApiKey?: string;
  staffNotificationEmail?: string;
  paymentProvider: "fake" | "mercadopago";
  mercadoPagoAccessToken?: string;
  mercadoPagoWebhookSecret?: string;
  paymentSuccessUrl: string;
  paymentFailureUrl: string;
  paymentPendingUrl: string;
  paymentWebhookUrl: string;
  checkoutReservationMinutes: number;
  logLevel: (typeof LOG_LEVELS)[number];
  jsonBodyLimitBytes: number;
  shutdownTimeoutMs: number;
  seedAdminEmail?: string;
  seedAdminPassword?: string;
}>;

export class EnvironmentValidationError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super(`Configuración de entorno inválida: ${fields.join(", ")}.`);
    this.name = "EnvironmentValidationError";
    this.fields = fields;
  }
}

export function parseEnvironment(
  input: Readonly<Record<string, string | undefined>>,
): AppConfig {
  const result = rawEnvironmentSchema.safeParse(input);

  if (!result.success) {
    const fields = Array.from(
      new Set(
        result.error.issues.map((issue) => issue.path.join(".") || "environment"),
      ),
    );
    throw new EnvironmentValidationError(fields);
  }

  const value = result.data;
  const appEnv = value.APP_ENV ??
    (value.NODE_ENV === "production" ? "production" : "local");
  const host = value.HOST ??
    (appEnv === "local" ? "127.0.0.1" : "0.0.0.0");
  const apiPublicUrl = value.API_PUBLIC_URL ??
    `http://127.0.0.1:${value.PORT}`;
  const fallbackPaymentUrl = (path: string): string =>
    new URL(path, value.WEB_ORIGIN).toString();
  const fallbackApiUrl = (path: string): string =>
    new URL(path, `${apiPublicUrl}/`).toString();
  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    appEnv,
    host,
    port: value.PORT,
    trustProxy: value.TRUST_PROXY,
    databaseUrl: value.DATABASE_URL,
    databasePoolMax: value.DATABASE_POOL_MAX,
    databaseConnectionTimeoutMs: value.DATABASE_CONNECTION_TIMEOUT_MS,
    databaseIdleTimeoutMs: value.DATABASE_IDLE_TIMEOUT_MS,
    webOrigin: value.WEB_ORIGIN,
    apiPublicUrl,
    organizationSlug: value.ORGANIZATION_SLUG,
    sessionSecret: value.SESSION_SECRET,
    sessionTtlSeconds: value.SESSION_TTL_SECONDS,
    sessionIdleTtlSeconds: value.SESSION_IDLE_TTL_SECONDS,
    csrfSecret: value.CSRF_SECRET,
    idempotencySecret: value.IDEMPOTENCY_SECRET,
    rateLimitSecret: value.RATE_LIMIT_SECRET,
    pickupCodeSecret: value.PICKUP_CODE_SECRET,
    emailProvider: value.EMAIL_PROVIDER,
    ...(value.EMAIL_FROM === undefined ? {} : { emailFrom: value.EMAIL_FROM }),
    ...(value.EMAIL_REPLY_TO === undefined
      ? {}
      : { emailReplyTo: value.EMAIL_REPLY_TO }),
    ...(value.RESEND_API_KEY === undefined
      ? {}
      : { resendApiKey: value.RESEND_API_KEY }),
    ...(value.STAFF_NOTIFICATION_EMAIL === undefined
      ? {}
      : { staffNotificationEmail: value.STAFF_NOTIFICATION_EMAIL }),
    paymentProvider: value.PAYMENT_PROVIDER ?? "fake",
    ...(value.MERCADOPAGO_ACCESS_TOKEN === undefined
      ? {}
      : { mercadoPagoAccessToken: value.MERCADOPAGO_ACCESS_TOKEN }),
    ...(value.MERCADOPAGO_WEBHOOK_SECRET === undefined
      ? {}
      : { mercadoPagoWebhookSecret: value.MERCADOPAGO_WEBHOOK_SECRET }),
    paymentSuccessUrl:
      value.PAYMENT_SUCCESS_URL ?? fallbackPaymentUrl("/checkout/resultado"),
    paymentFailureUrl:
      value.PAYMENT_FAILURE_URL ?? fallbackPaymentUrl("/checkout/resultado"),
    paymentPendingUrl:
      value.PAYMENT_PENDING_URL ?? fallbackPaymentUrl("/checkout/resultado"),
    paymentWebhookUrl:
      value.PAYMENT_WEBHOOK_URL ??
      fallbackApiUrl("/api/v1/webhooks/mercadopago"),
    checkoutReservationMinutes: value.CHECKOUT_RESERVATION_MINUTES,
    logLevel: value.LOG_LEVEL,
    jsonBodyLimitBytes: value.JSON_BODY_LIMIT_BYTES,
    shutdownTimeoutMs: value.SHUTDOWN_TIMEOUT_MS,
    ...(value.SEED_ADMIN_EMAIL === undefined
      ? {}
      : { seedAdminEmail: value.SEED_ADMIN_EMAIL }),
    ...(value.SEED_ADMIN_PASSWORD === undefined
      ? {}
      : { seedAdminPassword: value.SEED_ADMIN_PASSWORD }),
  });
}

export function loadEnvironment(): AppConfig {
  return parseEnvironment(process.env);
}

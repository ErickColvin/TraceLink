import { z } from "zod";

const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;
const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

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

const rawEnvironmentSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default("development"),
  HOST: z.string().trim().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: databaseUrlSchema,
  WEB_ORIGIN: webOriginSchema,
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(2_592_000)
    .default(28_800),
  CSRF_SECRET: z.string().min(32),
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
});

export type AppConfig = Readonly<{
  nodeEnv: (typeof NODE_ENVIRONMENTS)[number];
  host: string;
  port: number;
  databaseUrl: string;
  webOrigin: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  csrfSecret: string;
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
  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    webOrigin: value.WEB_ORIGIN,
    sessionSecret: value.SESSION_SECRET,
    sessionTtlSeconds: value.SESSION_TTL_SECONDS,
    csrfSecret: value.CSRF_SECRET,
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

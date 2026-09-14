import { z } from "zod";

const postgresUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "postgres:" || protocol === "postgresql:";
});

const schema = z.object({
  NODE_ENV: z.literal("production"),
  APP_ENV: z.literal("production"),
  DATABASE_URL: postgresUrlSchema,
  BOOTSTRAP_CONFIRM: z.literal("CREATE_CH_MARKET"),
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email().max(254),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128),
  BOOTSTRAP_ADMIN_FIRST_NAME: z.string().trim().min(1).max(100),
  BOOTSTRAP_ADMIN_LAST_NAME: z.string().trim().min(1).max(100),
  BOOTSTRAP_CONTACT_EMAIL: z.string().trim().email().max(254),
  BOOTSTRAP_CONTACT_PHONE: z.string().trim().min(5).max(32),
  BOOTSTRAP_PICKUP_ADDRESS: z.string().trim().min(5).max(500),
  BOOTSTRAP_PICKUP_INSTRUCTIONS: z.string().trim().min(5).max(1_000),
  BOOTSTRAP_LOW_STOCK_THRESHOLD: z.coerce.number().int().min(0).max(1_000),
  BOOTSTRAP_PACKAGE_ALERT_DAYS: z.coerce.number().int().min(0).max(365),
  BOOTSTRAP_EXPIRATION_WARNING_DAYS: z.coerce.number().int().min(0).max(365),
}).superRefine((value, context) => {
  const forbiddenPasswords = new Set([
    "replace-before-seeding",
    "password123",
    "admin123456",
  ]);
  if (forbiddenPasswords.has(value.BOOTSTRAP_ADMIN_PASSWORD.toLowerCase())) {
    context.addIssue({
      code: "custom",
      path: ["BOOTSTRAP_ADMIN_PASSWORD"],
      message: "La contraseña de bootstrap no puede ser un valor de ejemplo.",
    });
  }
});

export type ProductionBootstrapConfig = Readonly<z.infer<typeof schema>>;

export class ProductionBootstrapEnvironmentError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super(`Configuración de bootstrap inválida: ${fields.join(", ")}.`);
    this.name = "ProductionBootstrapEnvironmentError";
    this.fields = fields;
  }
}

export function parseProductionBootstrapEnvironment(
  input: Readonly<Record<string, string | undefined>>,
): ProductionBootstrapConfig {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ProductionBootstrapEnvironmentError(
      Array.from(new Set(
        result.error.issues.map((issue) => issue.path.join(".") || "environment"),
      )),
    );
  }
  return Object.freeze(result.data);
}

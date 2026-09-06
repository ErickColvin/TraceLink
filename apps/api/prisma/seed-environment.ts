import { z } from "zod";

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(12).max(128);

const documentedPlaceholders = Object.freeze({
  DATABASE_URL:
    "postgresql://tracelink:replace-with-a-local-only-password@127.0.0.1:5432/tracelink?schema=public",
  PICKUP_CODE_SECRET: "replace-with-base64-pickup-code-secret-at-least-32-bytes",
  SEED_ADMIN_EMAIL: "admin@example.invalid",
  SEED_ADMIN_PASSWORD: "replace-before-seeding",
  SEED_STAFF_EMAIL: "staff@example.invalid",
  SEED_STAFF_PASSWORD: "replace-before-seeding",
  SEED_CUSTOMER_EMAIL: "customer@example.invalid",
  SEED_CUSTOMER_PASSWORD: "replace-before-seeding",
  SEED_PACKAGE_PICKUP_CODE: "replace-before-seeding",
} as const);

const seedEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test"]),
    DATABASE_URL: z.string().url().refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    }),
    PICKUP_CODE_SECRET: z.string().min(32),
    SEED_ADMIN_EMAIL: emailSchema,
    SEED_ADMIN_PASSWORD: passwordSchema,
    SEED_STAFF_EMAIL: emailSchema,
    SEED_STAFF_PASSWORD: passwordSchema.optional(),
    SEED_CUSTOMER_EMAIL: emailSchema,
    SEED_CUSTOMER_PASSWORD: passwordSchema.optional(),
    SEED_PACKAGE_PICKUP_CODE: z.string().trim().min(4).max(128),
  })
  .superRefine((value, context) => {
    for (const [field, placeholder] of Object.entries(documentedPlaceholders)) {
      const candidate = Reflect.get(value, field);
      if (
        typeof candidate === "string" &&
        candidate.trim().toLowerCase() === placeholder.toLowerCase()
      ) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Reemplaza el valor de ejemplo antes de ejecutar el seed.",
        });
      }
    }

    const emails = [
      value.SEED_ADMIN_EMAIL,
      value.SEED_STAFF_EMAIL,
      value.SEED_CUSTOMER_EMAIL,
    ].map((email) => email.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      context.addIssue({
        code: "custom",
        path: ["SEED_STAFF_EMAIL"],
        message: "Las identidades demo deben usar correos distintos.",
      });
    }
  });

export type SeedEnvironment = Readonly<z.infer<typeof seedEnvironmentSchema>>;

export class SeedEnvironmentValidationError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super(`Configuración de seed inválida: ${fields.join(", ")}.`);
    this.name = "SeedEnvironmentValidationError";
    this.fields = fields;
  }
}

export function parseSeedEnvironment(
  input: Readonly<Record<string, string | undefined>>,
): SeedEnvironment {
  const result = seedEnvironmentSchema.safeParse(input);
  if (!result.success) {
    const fields = Array.from(
      new Set(
        result.error.issues.map((issue) => issue.path.join(".") || "environment"),
      ),
    );
    throw new SeedEnvironmentValidationError(fields);
  }
  return Object.freeze(result.data);
}

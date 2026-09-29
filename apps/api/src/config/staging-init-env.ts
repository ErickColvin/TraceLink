import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.literal("production"),
  APP_ENV: z.literal("staging"),
  PAYMENT_PROVIDER: z.literal("fake"),
  EMAIL_PROVIDER: z.literal("fake"),
  STAGING_INIT_CONFIRM: z.literal("INIT_CH_MARKET"),
  RAILWAY_ENVIRONMENT_NAME: z.literal("staging").optional(),
  ORGANIZATION_SLUG: z.literal("ch-market").optional(),
  DATABASE_URL: z.string().url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  }),
  STAGING_CONTACT_EMAIL: z.string().trim().email().max(254),
  STAGING_CONTACT_PHONE: z.string().trim().min(6).max(32),
  STAGING_PICKUP_ADDRESS: z.string().trim().min(5).max(500),
  STAGING_PICKUP_INSTRUCTIONS: z.string().trim().min(1).max(2_000),
  STAGING_ADMIN_EMAIL: z.string().trim().email().max(254).toLowerCase().optional(),
  STAGING_ADMIN_PASSWORD: z.string().min(24).max(128)
    .refine((value) => value.trim().length >= 24).optional(),
}).superRefine((value, context) => {
  if ((value.STAGING_ADMIN_EMAIL === undefined) !==
      (value.STAGING_ADMIN_PASSWORD === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD"],
      message: "Both staging admin variables must be provided together.",
    });
  }
});

export type StagingInitConfig = Readonly<z.infer<typeof schema>>;

export class StagingInitEnvironmentError extends Error {
  constructor(readonly fields: readonly string[]) {
    // Never retain Zod issues/input: they may contain passwords or DATABASE_URL.
    super(`STAGING_INIT_ENV_INVALID: ${fields.join(", ")}.`);
    this.name = "StagingInitEnvironmentError";
  }
}

export function parseStagingInitEnvironment(
  input: Readonly<Record<string, string | undefined>>,
): StagingInitConfig {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new StagingInitEnvironmentError(Array.from(new Set(
      result.error.issues.flatMap((issue) => issue.path.map(String)),
    )));
  }
  return Object.freeze(result.data);
}

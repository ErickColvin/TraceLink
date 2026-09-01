import { z } from "zod";

import {
  emailSchema,
  isoDateTimeSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
} from "../common/index.js";

const organizationSettingsInputShape = {
  organizationName: z.string().trim().min(1).max(160),
  locale: z.string().trim().min(2).max(35),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(1).max(100),
  contactEmail: emailSchema,
  contactPhone: z.string().trim().min(6).max(32),
  pickupAddress: z.string().trim().min(1).max(500),
  pickupInstructions: z.string().trim().min(1).max(2_000),
  lowStockThreshold: nonNegativeIntegerSchema,
  packageAlertDays: positiveIntegerSchema,
  expirationWarningDays: positiveIntegerSchema,
} satisfies z.ZodRawShape;

export const organizationSettingsInputSchema = z
  .object(organizationSettingsInputShape)
  .strict();

export const organizationSettingsSchema = z
  .object({
    ...organizationSettingsInputShape,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type OrganizationSettingsInput = z.infer<
  typeof organizationSettingsInputSchema
>;
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

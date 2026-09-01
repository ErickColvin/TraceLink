import { z } from "zod";

export const entityIdSchema = z.string().trim().min(1).max(128);
export const nonEmptyTextSchema = z.string().trim().min(1);
export const emailSchema = z.string().trim().email().max(254);
export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const clpAmountSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
export const nonNegativeIntegerSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
export const positiveIntegerSchema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);
export const idempotencyKeySchema = z.string().trim().min(8).max(255);
export const csrfTokenSchema = z.string().trim().min(32).max(512);

export type EntityId = z.infer<typeof entityIdSchema>;
export type ClpAmount = z.infer<typeof clpAmountSchema>;

import { z } from "zod";

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INVALID_STATE_TRANSITION",
  "INSUFFICIENT_STOCK",
  "IDEMPOTENCY_CONFLICT",
] as const;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const apiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z.string().trim().min(1).max(1_000),
        fieldErrors: z
          .record(z.string().trim().min(1), z.array(z.string().trim().min(1)))
          .optional(),
      })
      .strict(),
    requestId: z.string().trim().min(1).max(128),
  })
  .strict();

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

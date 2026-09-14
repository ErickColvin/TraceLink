import { z } from "zod";

import {
  clpAmountSchema,
  entityIdSchema,
  isoDateTimeSchema,
  positiveIntegerSchema,
} from "../common/index.js";

export const PAYMENT_PROVIDERS = ["MERCADOPAGO", "FAKE"] as const;
export const PAYMENT_LIFECYCLE_STATUSES = [
  "CREATED",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
  "ERROR",
] as const;

export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS);
export const paymentLifecycleStatusSchema = z.enum(
  PAYMENT_LIFECYCLE_STATUSES,
);

const currencyCodeSchema = z.string().trim().regex(/^[A-Z]{3}$/u);
const providerIdentifierSchema = z.string().trim().min(1).max(160);
const providerStatusSchema = z.string().trim().min(1).max(240);

export const paymentSchema = z
  .object({
    id: entityIdSchema,
    orderId: entityIdSchema,
    provider: paymentProviderSchema,
    status: paymentLifecycleStatusSchema,
    amount: clpAmountSchema,
    currency: currencyCodeSchema,
    providerExternalReference: providerIdentifierSchema,
    providerPaymentId: providerIdentifierSchema.optional(),
    providerStatus: providerStatusSchema.optional(),
    providerStatusDetail: providerStatusSchema.optional(),
    approvedAt: isoDateTimeSchema.optional(),
    cancelledAt: isoDateTimeSchema.optional(),
    refundedAt: isoDateTimeSchema.optional(),
    lastReconciledAt: isoDateTimeSchema.optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const paymentAttemptSchema = z
  .object({
    id: entityIdSchema,
    paymentId: entityIdSchema,
    attemptNumber: positiveIntegerSchema,
    status: paymentLifecycleStatusSchema,
    providerOrderId: providerIdentifierSchema.optional(),
    providerPreferenceId: providerIdentifierSchema.optional(),
    checkoutUrl: z
      .url()
      .refine((value) => /^https?:\/\//iu.test(value), {
        message: "checkoutUrl debe usar HTTP(S).",
      })
      .optional(),
    errorCode: z.string().trim().min(1).max(160).optional(),
    errorMessage: z.string().trim().min(1).max(1_000).optional(),
    startedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const refundSchema = z
  .object({
    id: entityIdSchema,
    paymentId: entityIdSchema,
    status: paymentLifecycleStatusSchema,
    amount: clpAmountSchema,
    reason: z.string().trim().min(3).max(1_000),
    requestedByUserId: entityIdSchema.optional(),
    providerRefundId: providerIdentifierSchema.optional(),
    requestedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const paymentDetailsSchema = z
  .object({
    payment: paymentSchema,
    attempts: z.array(paymentAttemptSchema),
    refund: refundSchema.optional(),
  })
  .strict();

export const paymentIdParamsSchema = z
  .object({ id: entityIdSchema })
  .strict();

export const cancelPaymentRequestSchema = z
  .object({ reason: z.string().trim().min(3).max(1_000) })
  .strict();

export const retryPaymentRequestSchema = z.object({}).strict();

export const createFullRefundRequestSchema = z
  .object({ reason: z.string().trim().min(3).max(1_000) })
  .strict();

export const refundRequestSchema = createFullRefundRequestSchema;

export const customerOrderCancellationResponseSchema = z
  .object({
    orderId: entityIdSchema,
    status: z.literal("CANCELLED"),
    paymentStatus: z.literal("CANCELLED"),
  })
  .strict();

export const paymentWebhookResponseSchema = z
  .object({ received: z.literal(true) })
  .strict();

export const fullRefundResponseSchema = z
  .object({
    payment: paymentSchema,
    refund: refundSchema,
  })
  .strict();

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
export type PaymentLifecycleStatus = z.infer<
  typeof paymentLifecycleStatusSchema
>;
export type Payment = z.infer<typeof paymentSchema>;
export type PaymentAttempt = z.infer<typeof paymentAttemptSchema>;
export type Refund = z.infer<typeof refundSchema>;
export type PaymentDetails = z.infer<typeof paymentDetailsSchema>;
export type CancelPaymentRequest = z.infer<typeof cancelPaymentRequestSchema>;
export type RetryPaymentRequest = z.infer<typeof retryPaymentRequestSchema>;
export type CreateFullRefundRequest = z.infer<
  typeof createFullRefundRequestSchema
>;
export type RefundRequest = z.infer<typeof refundRequestSchema>;
export type CustomerOrderCancellationResponse = z.infer<
  typeof customerOrderCancellationResponseSchema
>;
export type PaymentWebhookResponse = z.infer<
  typeof paymentWebhookResponseSchema
>;
export type FullRefundResponse = z.infer<typeof fullRefundResponseSchema>;

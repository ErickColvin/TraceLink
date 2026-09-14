import { z } from "zod";

import {
  clpAmountSchema,
  entityIdSchema,
  isoDateTimeSchema,
  positiveIntegerSchema,
} from "../common/index.js";
import {
  orderStatusSchema,
  paymentStatusSchema,
} from "../orders/index.js";
import { paymentAttemptSchema, paymentSchema } from "./payment.js";

const httpUrlSchema = z
  .url()
  .refine((value) => /^https?:\/\//iu.test(value), {
    message: "La URL de checkout debe usar HTTP(S).",
  });

export const checkoutItemSchema = z
  .object({
    productId: entityIdSchema,
    quantity: positiveIntegerSchema,
  })
  .strict();

export const createCheckoutRequestSchema = z
  .object({
    items: z.array(checkoutItemSchema).min(1).max(100),
    fulfillmentMethod: z.literal("PICKUP"),
    notes: z.string().trim().min(1).max(5_000).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const seenProductIds = new Set<string>();
    request.items.forEach((item, index) => {
      if (seenProductIds.has(item.productId)) {
        context.addIssue({
          code: "custom",
          message: "Cada producto debe aparecer una sola vez.",
          path: ["items", index, "productId"],
        });
      }
      seenProductIds.add(item.productId);
    });
  });

export const checkoutRequestSchema = createCheckoutRequestSchema;

export const checkoutOrderSchema = z
  .object({
    id: entityIdSchema,
    orderNumber: z.string().trim().min(1).max(80),
    status: orderStatusSchema,
    paymentStatus: paymentStatusSchema,
    fulfillmentMethod: z.literal("PICKUP"),
    subtotal: clpAmountSchema,
    discountTotal: clpAmountSchema,
    deliveryFee: clpAmountSchema,
    total: clpAmountSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const checkoutResponseSchema = z
  .object({
    order: checkoutOrderSchema,
    payment: paymentSchema,
    attempt: paymentAttemptSchema,
    checkoutUrl: httpUrlSchema,
    reservationExpiresAt: isoDateTimeSchema,
  })
  .strict();

export const paymentRetryResponseSchema = checkoutResponseSchema;
export const retryPaymentResponseSchema = paymentRetryResponseSchema;

export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type CreateCheckoutRequest = z.infer<typeof createCheckoutRequestSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutOrder = z.infer<typeof checkoutOrderSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
export type PaymentRetryResponse = z.infer<typeof paymentRetryResponseSchema>;
export type RetryPaymentResponse = z.infer<typeof retryPaymentResponseSchema>;

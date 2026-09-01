import { z } from "zod";

import {
  clpAmountSchema,
  entityIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  positiveIntegerSchema,
} from "../common/index.js";
import {
  createPaginatedResponseSchema,
  pageSchema,
  pageSizeSchema,
} from "../pagination/index.js";

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;
export const ORDER_TRANSITION_TARGETS = [
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
] as const;
export const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED"] as const;
export const FULFILLMENT_METHODS = ["PICKUP", "DELIVERY"] as const;
export const ORDER_SORT_OPTIONS = [
  "NEWEST",
  "OLDEST",
  "TOTAL_DESC",
  "TOTAL_ASC",
] as const;
export const STAFF_ORDER_SORT_OPTIONS = [
  "QUEUE",
  "NEWEST",
  "OLDEST",
  "TOTAL_DESC",
] as const;

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const orderTransitionTargetSchema = z.enum(ORDER_TRANSITION_TARGETS);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const fulfillmentMethodSchema = z.enum(FULFILLMENT_METHODS);
export const orderSortSchema = z.enum(ORDER_SORT_OPTIONS);
export const staffOrderSortSchema = z.enum(STAFF_ORDER_SORT_OPTIONS);

export const orderItemSchema = z
  .object({
    id: entityIdSchema,
    productId: entityIdSchema,
    sku: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    imageUrl: z.string().trim().min(1).max(2_048).optional(),
    quantity: positiveIntegerSchema,
    unitPrice: clpAmountSchema,
    lineTotal: clpAmountSchema,
  })
  .strict();

const orderShape = {
  id: entityIdSchema,
  orderNumber: z.string().trim().min(1).max(100),
  customerId: entityIdSchema,
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  fulfillmentMethod: fulfillmentMethodSchema,
  items: z.array(orderItemSchema),
  subtotal: clpAmountSchema,
  discountTotal: clpAmountSchema,
  deliveryFee: clpAmountSchema,
  total: clpAmountSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  estimatedReadyAt: isoDateTimeSchema.optional(),
  completedAt: isoDateTimeSchema.optional(),
  pickupLocation: z.string().trim().min(1).max(500).optional(),
  notes: z.string().trim().min(1).max(5_000).optional(),
  packageIds: z.array(entityIdSchema),
} satisfies z.ZodRawShape;

export const orderSchema = z.object(orderShape).strict();

export const currentCustomerOrderListParamsSchema = z
  .object({
    statuses: z.array(orderStatusSchema).optional(),
    sort: orderSortSchema.optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const staffOrderCustomerSchema = z
  .object({
    id: entityIdSchema,
    fullName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(1).max(32).optional(),
  })
  .strict();

export const orderStatusEventSchema = z
  .object({
    id: entityIdSchema,
    orderId: entityIdSchema,
    fromStatus: orderStatusSchema.nullable(),
    toStatus: orderStatusSchema,
    occurredAt: isoDateTimeSchema,
    actorId: entityIdSchema,
    actorName: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export const staffOrderSchema = z
  .object({
    ...orderShape,
    customer: staffOrderCustomerSchema,
    statusEvents: z.array(orderStatusEventSchema),
    cancellationReason: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export const staffOrderListParamsSchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    statuses: z.array(orderStatusSchema).optional(),
    paymentStatuses: z.array(paymentStatusSchema).optional(),
    fulfillmentMethods: z.array(fulfillmentMethodSchema).optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    sort: staffOrderSortSchema.optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict()
  .superRefine((params, context) => {
    if (params.dateFrom && params.dateTo && params.dateFrom > params.dateTo) {
      context.addIssue({
        code: "custom",
        message: "dateFrom no puede ser posterior a dateTo.",
        path: ["dateFrom"],
      });
    }
  });

export const orderTransitionRequestSchema = z
  .object({ toStatus: orderTransitionTargetSchema })
  .strict();
export const orderCancellationRequestSchema = z
  .object({ reason: z.string().trim().min(3).max(1_000) })
  .strict();
export const orderIdParamsSchema = z
  .object({ id: entityIdSchema })
  .strict();

export const orderPageSchema = createPaginatedResponseSchema(orderSchema);
export const staffOrderPageSchema = createPaginatedResponseSchema(staffOrderSchema);

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderTransitionTarget = z.infer<typeof orderTransitionTargetSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type FulfillmentMethod = z.infer<typeof fulfillmentMethodSchema>;
export type OrderSort = z.infer<typeof orderSortSchema>;
export type StaffOrderSort = z.infer<typeof staffOrderSortSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type CurrentCustomerOrderListParams = z.infer<
  typeof currentCustomerOrderListParamsSchema
>;
export type StaffOrderCustomer = z.infer<typeof staffOrderCustomerSchema>;
export type OrderStatusEvent = z.infer<typeof orderStatusEventSchema>;
export type StaffOrder = z.infer<typeof staffOrderSchema>;
export type StaffOrderListParams = z.infer<typeof staffOrderListParamsSchema>;
export type OrderTransitionRequest = z.infer<typeof orderTransitionRequestSchema>;
export type OrderCancellationRequest = z.infer<
  typeof orderCancellationRequestSchema
>;
export type OrderPage = z.infer<typeof orderPageSchema>;
export type StaffOrderPage = z.infer<typeof staffOrderPageSchema>;

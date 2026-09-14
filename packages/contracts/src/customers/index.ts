import { z } from "zod";

import {
  clpAmountSchema,
  emailSchema,
  entityIdSchema,
  isoDateTimeSchema,
  nonNegativeIntegerSchema,
} from "../common/index.js";
import { orderStatusSchema } from "../orders/index.js";
import { packageStatusSchema } from "../packages/index.js";
import {
  createPaginatedResponseSchema,
  pageSchema,
  pageSizeSchema,
} from "../pagination/index.js";

export const CUSTOMER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const CUSTOMER_SORT_OPTIONS = [
  "NEWEST",
  "NAME_ASC",
  "NAME_DESC",
] as const;
export const CUSTOMER_ACTIVITY_KINDS = [
  "CUSTOMER_CREATED",
  "PROFILE_UPDATED",
  "ORDER_UPDATED",
  "PACKAGE_UPDATED",
] as const;
export const CUSTOMER_ACTIVITY_ACTORS = ["CUSTOMER", "STAFF", "SYSTEM"] as const;

export const customerStatusSchema = z.enum(CUSTOMER_STATUSES);
export const customerSortSchema = z.enum(CUSTOMER_SORT_OPTIONS);
export const customerActivityKindSchema = z.enum(CUSTOMER_ACTIVITY_KINDS);
export const customerActivityActorSchema = z.enum(CUSTOMER_ACTIVITY_ACTORS);

export const customerAddressSchema = z
  .object({
    line1: z.string().trim().min(1).max(300),
    line2: z.string().trim().min(1).max(300).optional(),
    commune: z.string().trim().min(1).max(160),
    city: z.string().trim().min(1).max(160),
    region: z.string().trim().min(1).max(160),
  })
  .strict();

const customerProfileShape = {
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: z.string().trim().min(6).max(32).optional(),
  address: customerAddressSchema.optional(),
} satisfies z.ZodRawShape;

export const customerProfileInputSchema = z
  .object(customerProfileShape)
  .strict();

export const customerSchema = z
  .object({
    id: entityIdSchema,
    ...customerProfileShape,
    taxId: z.string().trim().min(1).max(32).optional(),
    status: customerStatusSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const staffCustomerUpdateInputSchema = z
  .object({
    ...customerProfileShape,
    status: customerStatusSchema,
  })
  .strict();

export const staffCustomerListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    status: customerStatusSchema.optional(),
    sort: customerSortSchema.optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const staffCustomerSummarySchema = customerSchema
  .extend({
    orderCount: nonNegativeIntegerSchema,
    activePackageCount: nonNegativeIntegerSchema,
    lastActivityAt: isoDateTimeSchema,
  })
  .strict();

export const customerOrderSummarySchema = z
  .object({
    id: entityIdSchema,
    orderNumber: z.string().trim().min(1).max(100),
    status: orderStatusSchema,
    total: clpAmountSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const customerPackageSummarySchema = z
  .object({
    id: entityIdSchema,
    trackingCode: z.string().trim().min(1).max(160),
    status: packageStatusSchema,
    description: z.string().trim().min(1).max(2_000),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const customerActivityEventSchema = z
  .object({
    id: entityIdSchema,
    kind: customerActivityKindSchema,
    occurredAt: isoDateTimeSchema,
    description: z.string().trim().min(1).max(2_000),
    actor: customerActivityActorSchema,
  })
  .strict();

export const staffCustomerDetailSchema = z
  .object({
    customer: customerSchema,
    orderCount: nonNegativeIntegerSchema,
    activePackageCount: nonNegativeIntegerSchema,
    lastActivityAt: isoDateTimeSchema,
    recentOrders: z.array(customerOrderSummarySchema),
    activePackages: z.array(customerPackageSummarySchema),
    activity: z.array(customerActivityEventSchema),
  })
  .strict();

export const customerIdParamsSchema = z
  .object({ id: entityIdSchema })
  .strict();
export const staffCustomerPageSchema = createPaginatedResponseSchema(
  staffCustomerSummarySchema,
);

export type CustomerStatus = z.infer<typeof customerStatusSchema>;
export type CustomerSort = z.infer<typeof customerSortSchema>;
export type CustomerAddress = z.infer<typeof customerAddressSchema>;
export type CustomerProfileInput = z.infer<typeof customerProfileInputSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type StaffCustomerUpdateInput = z.infer<
  typeof staffCustomerUpdateInputSchema
>;
export type StaffCustomerListParams = z.infer<
  typeof staffCustomerListParamsSchema
>;
export type StaffCustomerSummary = z.infer<typeof staffCustomerSummarySchema>;
export type CustomerOrderSummary = z.infer<typeof customerOrderSummarySchema>;
export type CustomerPackageSummary = z.infer<
  typeof customerPackageSummarySchema
>;
export type CustomerActivityEvent = z.infer<typeof customerActivityEventSchema>;
export type StaffCustomerDetail = z.infer<typeof staffCustomerDetailSchema>;
export type StaffCustomerPage = z.infer<typeof staffCustomerPageSchema>;

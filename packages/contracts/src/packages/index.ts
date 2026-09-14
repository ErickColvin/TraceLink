import { z } from "zod";

import {
  booleanQuerySchema,
  entityIdSchema,
  isoDateTimeSchema,
  positiveIntegerSchema,
} from "../common/index.js";
import {
  createPaginatedResponseSchema,
  pageSchema,
  pageSizeSchema,
} from "../pagination/index.js";

export const PACKAGE_STATUSES = [
  "EXPECTED",
  "RECEIVED",
  "STORED",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "RETURNED",
  "LOST",
  "INCIDENT",
] as const;
export const PACKAGE_TRANSITION_TARGETS = [
  "RECEIVED",
  "STORED",
  "READY_FOR_PICKUP",
  "RETURNED",
  "LOST",
  "INCIDENT",
] as const;
export const PACKAGE_SORT_OPTIONS = ["NEWEST", "OLDEST", "STATUS"] as const;
export const STAFF_PACKAGE_SORT_OPTIONS = [
  "QUEUE",
  "NEWEST",
  "OLDEST",
  "STATUS",
] as const;
export const PACKAGE_CARRIERS = [
  "Blue Express",
  "Chilexpress",
  "Starken",
  "CH Market",
] as const;

export const packageStatusSchema = z.enum(PACKAGE_STATUSES);
export const packageTransitionTargetSchema = z.enum(PACKAGE_TRANSITION_TARGETS);
export const packageSortSchema = z.enum(PACKAGE_SORT_OPTIONS);
export const staffPackageSortSchema = z.enum(STAFF_PACKAGE_SORT_OPTIONS);
export const knownPackageCarrierSchema = z.enum(PACKAGE_CARRIERS);

export const packageContentsSchema = z
  .object({
    description: z.string().trim().min(1).max(2_000),
    itemCount: positiveIntegerSchema,
    requiresColdStorage: z.boolean(),
  })
  .strict();

export const trackingEventSchema = z
  .object({
    id: entityIdSchema,
    status: packageStatusSchema,
    occurredAt: isoDateTimeSchema,
    description: z.string().trim().min(1).max(2_000),
    location: z.string().trim().min(1).max(200).optional(),
    recordedBy: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const customerPackageShape = {
  id: entityIdSchema,
  trackingCode: z.string().trim().min(1).max(160),
  customerId: entityIdSchema,
  orderId: entityIdSchema.optional(),
  status: packageStatusSchema,
  contents: packageContentsSchema,
  expectedAt: isoDateTimeSchema.optional(),
  receivedAt: isoDateTimeSchema.optional(),
  pickupDeadline: isoDateTimeSchema.optional(),
  storageLocation: z.string().trim().min(1).max(200).optional(),
  weightKg: z.number().positive().max(100_000).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
} satisfies z.ZodRawShape;

export const customerPackageSchema = z
  .object({
    ...customerPackageShape,
    events: z.array(trackingEventSchema),
  })
  .strict();

export const currentCustomerPackageListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    statuses: z.array(packageStatusSchema).optional(),
    sort: packageSortSchema.optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const staffPackageCustomerSchema = z
  .object({
    id: entityIdSchema,
    fullName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(1).max(32).optional(),
  })
  .strict();

export const packageActorSchema = z
  .object({
    id: entityIdSchema,
    name: z.string().trim().min(1).max(200),
  })
  .strict();

/** Canonical staff event. UI-only aliases are added by the web adapter. */
export const staffTrackingEventSchema = z
  .object({
    id: entityIdSchema,
    previousStatus: packageStatusSchema.nullable(),
    newStatus: packageStatusSchema,
    occurredAt: isoDateTimeSchema,
    description: z.string().trim().min(1).max(2_000),
    location: z.string().trim().min(1).max(200).optional(),
    actor: packageActorSchema,
    notes: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const packagePickupReceiptSchema = z
  .object({
    receivedBy: z.string().trim().min(3).max(200),
    pickupCodeVerified: z.literal(true),
    deliveredAt: isoDateTimeSchema,
    deliveredBy: z.string().trim().min(1).max(200),
  })
  .strict();

export const staffPackageSchema = z
  .object({
    ...customerPackageShape,
    carrier: z.string().trim().min(1).max(120),
    notes: z.string().trim().min(1).max(2_000).optional(),
    customer: staffPackageCustomerSchema,
    pickupReceipt: packagePickupReceiptSchema.optional(),
    events: z.array(staffTrackingEventSchema),
  })
  .strict();

export const staffPackageListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    tracking: z.string().trim().max(160).optional(),
    customer: z.string().trim().max(200).optional(),
    carrier: z.string().trim().max(120).optional(),
    location: z.string().trim().max(200).optional(),
    statuses: z.array(packageStatusSchema).optional(),
    coldStorage: booleanQuerySchema.optional(),
    sort: staffPackageSortSchema.optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const receivePackageRequestSchema = z
  .object({
    trackingCode: z.string().trim().min(1).max(160),
    carrier: z.string().trim().min(1).max(120),
    customerId: entityIdSchema,
    orderId: entityIdSchema.optional(),
    contents: packageContentsSchema,
    storageLocation: z.string().trim().min(1).max(200),
    notes: z.string().trim().min(1).max(2_000).optional(),
    expectedAt: isoDateTimeSchema.optional(),
    receivedAt: isoDateTimeSchema.optional(),
    weightKg: z.number().positive().max(100_000).optional(),
  })
  .strict();

export const transitionPackageRequestSchema = z
  .object({
    toStatus: packageTransitionTargetSchema,
    description: z.string().trim().min(1).max(2_000).optional(),
    location: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const deliverPackageRequestSchema = z
  .object({
    pickupCode: z.string().trim().min(4).max(128),
    receivedBy: z.string().trim().min(3).max(200),
  })
  .strict();

export const packageIdParamsSchema = z
  .object({ id: entityIdSchema })
  .strict();

export const packageCustomerOptionSchema = z
  .object({
    id: entityIdSchema,
    displayName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(254),
  })
  .strict();
export const packageCustomerOptionListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const packagePageSchema = createPaginatedResponseSchema(
  customerPackageSchema,
);
export const staffPackagePageSchema = createPaginatedResponseSchema(
  staffPackageSchema,
);
export const packageCustomerOptionPageSchema = createPaginatedResponseSchema(
  packageCustomerOptionSchema,
);

export type PackageStatus = z.infer<typeof packageStatusSchema>;
export type PackageTransitionTarget = z.infer<
  typeof packageTransitionTargetSchema
>;
export type PackageSort = z.infer<typeof packageSortSchema>;
export type StaffPackageSort = z.infer<typeof staffPackageSortSchema>;
export type PackageContents = z.infer<typeof packageContentsSchema>;
export type TrackingEvent = z.infer<typeof trackingEventSchema>;
export type CustomerPackage = z.infer<typeof customerPackageSchema>;
export type CurrentCustomerPackageListParams = z.infer<
  typeof currentCustomerPackageListParamsSchema
>;
export type StaffPackageCustomer = z.infer<typeof staffPackageCustomerSchema>;
export type PackageActor = z.infer<typeof packageActorSchema>;
export type StaffTrackingEvent = z.infer<typeof staffTrackingEventSchema>;
export type PackagePickupReceipt = z.infer<typeof packagePickupReceiptSchema>;
export type StaffPackage = z.infer<typeof staffPackageSchema>;
export type StaffPackageListParams = z.infer<
  typeof staffPackageListParamsSchema
>;
export type ReceivePackageRequest = z.infer<typeof receivePackageRequestSchema>;
export type TransitionPackageRequest = z.infer<
  typeof transitionPackageRequestSchema
>;
export type DeliverPackageRequest = z.infer<typeof deliverPackageRequestSchema>;
export type PackageCustomerOption = z.infer<typeof packageCustomerOptionSchema>;
export type PackagePage = z.infer<typeof packagePageSchema>;
export type StaffPackagePage = z.infer<typeof staffPackagePageSchema>;
export type PackageCustomerOptionPage = z.infer<
  typeof packageCustomerOptionPageSchema
>;

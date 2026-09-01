import { z } from "zod";

import {
  entityIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
} from "../common/index.js";
import {
  createPaginatedResponseSchema,
  pageSchema,
  pageSizeSchema,
} from "../pagination/index.js";

export const INVENTORY_STATUSES = [
  "OK",
  "LOW",
  "OUT",
  "EXPIRING",
  "EXPIRED",
] as const;
export const INVENTORY_SORT_OPTIONS = [
  "PRODUCT_ASC",
  "AVAILABLE_ASC",
  "AVAILABLE_DESC",
  "EXPIRY_ASC",
  "UPDATED_DESC",
] as const;
export const INVENTORY_EXPIRY_FILTERS = [
  "WITH_EXPIRY",
  "WITHOUT_EXPIRY",
  "EXPIRING",
  "EXPIRED",
] as const;
export const INVENTORY_MOVEMENT_TYPES = [
  "PURCHASE_RECEIPT",
  "SALE",
  "ADJUSTMENT",
  "RETURN",
  "DAMAGE",
  "EXPIRED",
  "TRANSFER_IN",
  "TRANSFER_OUT",
] as const;
export const INVENTORY_ADJUSTMENT_DIRECTIONS = [
  "INCREASE",
  "DECREASE",
] as const;

export const inventoryStatusSchema = z.enum(INVENTORY_STATUSES);
export const inventorySortSchema = z.enum(INVENTORY_SORT_OPTIONS);
export const inventoryExpiryFilterSchema = z.enum(INVENTORY_EXPIRY_FILTERS);
export const inventoryMovementTypeSchema = z.enum(INVENTORY_MOVEMENT_TYPES);
export const inventoryAdjustmentDirectionSchema = z.enum(
  INVENTORY_ADJUSTMENT_DIRECTIONS,
);

export const inventoryCategorySchema = z
  .object({
    id: entityIdSchema,
    name: z.string().trim().min(1).max(160),
  })
  .strict();

export const inventoryItemSchema = z
  .object({
    id: entityIdSchema,
    productId: entityIdSchema,
    sku: z.string().trim().min(1).max(100),
    barcode: z.string().trim().min(1).max(100).optional(),
    productName: z.string().trim().min(1).max(200),
    categoryId: entityIdSchema,
    categoryName: z.string().trim().min(1).max(160),
    physicalStock: nonNegativeIntegerSchema,
    reservedStock: nonNegativeIntegerSchema,
    availableStock: nonNegativeIntegerSchema,
    minimumStock: nonNegativeIntegerSchema,
    location: z.string().trim().min(1).max(200),
    batch: z.string().trim().min(1).max(120).optional(),
    expiresAt: isoDateSchema.optional(),
    status: inventoryStatusSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((item, context) => {
    if (item.reservedStock > item.physicalStock) {
      context.addIssue({
        code: "custom",
        message: "reservedStock no puede superar physicalStock.",
        path: ["reservedStock"],
      });
    }
    if (item.availableStock !== item.physicalStock - item.reservedStock) {
      context.addIssue({
        code: "custom",
        message: "availableStock debe ser physicalStock - reservedStock.",
        path: ["availableStock"],
      });
    }
  });

export const inventoryListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    categoryId: entityIdSchema.optional(),
    location: z.string().trim().max(200).optional(),
    expiry: inventoryExpiryFilterSchema.optional(),
    statuses: z.array(inventoryStatusSchema).optional(),
    sort: inventorySortSchema.optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const inventoryStockSnapshotSchema = z
  .object({
    physicalStock: nonNegativeIntegerSchema,
    reservedStock: nonNegativeIntegerSchema,
    availableStock: nonNegativeIntegerSchema,
  })
  .strict();

export const createInventoryMovementRequestSchema = z
  .object({
    inventoryItemId: entityIdSchema,
    type: inventoryMovementTypeSchema,
    quantity: positiveIntegerSchema,
    adjustmentDirection: inventoryAdjustmentDirectionSchema,
    originLocation: z.string().trim().min(1).max(200).optional(),
    destinationLocation: z.string().trim().min(1).max(200).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
    notes: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const inventoryMovementPreviewSchema = z
  .object({
    inventoryItemId: entityIdSchema,
    quantityDelta: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
    before: inventoryStockSnapshotSchema,
    after: inventoryStockSnapshotSchema,
    resultingStatus: inventoryStatusSchema,
  })
  .strict();

export const inventoryMovementSchema = inventoryMovementPreviewSchema
  .extend({
    id: entityIdSchema,
    productId: entityIdSchema,
    sku: z.string().trim().min(1).max(100),
    productName: z.string().trim().min(1).max(200),
    type: inventoryMovementTypeSchema,
    quantity: positiveIntegerSchema,
    originLocation: z.string().trim().min(1).max(200),
    destinationLocation: z.string().trim().min(1).max(200).optional(),
    batch: z.string().trim().min(1).max(120).optional(),
    expiresAt: isoDateSchema.optional(),
    reason: z.string().trim().min(1).max(500).optional(),
    notes: z.string().trim().min(1).max(2_000).optional(),
    createdAt: isoDateTimeSchema,
    createdBy: z.string().trim().min(1).max(200),
  })
  .strict();

export const inventoryMovementListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    inventoryItemId: entityIdSchema.optional(),
    types: z.array(inventoryMovementTypeSchema).optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
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

export const inventoryIdParamsSchema = z
  .object({ id: entityIdSchema })
  .strict();
export const inventoryPageSchema = createPaginatedResponseSchema(inventoryItemSchema);
export const inventoryMovementPageSchema = createPaginatedResponseSchema(
  inventoryMovementSchema,
);

export type InventoryStatus = z.infer<typeof inventoryStatusSchema>;
export type InventorySort = z.infer<typeof inventorySortSchema>;
export type InventoryExpiryFilter = z.infer<typeof inventoryExpiryFilterSchema>;
export type InventoryMovementType = z.infer<typeof inventoryMovementTypeSchema>;
export type InventoryAdjustmentDirection = z.infer<
  typeof inventoryAdjustmentDirectionSchema
>;
export type InventoryCategory = z.infer<typeof inventoryCategorySchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type InventoryListParams = z.infer<typeof inventoryListParamsSchema>;
export type InventoryStockSnapshot = z.infer<
  typeof inventoryStockSnapshotSchema
>;
export type CreateInventoryMovementRequest = z.infer<
  typeof createInventoryMovementRequestSchema
>;
export type InventoryMovementPreview = z.infer<
  typeof inventoryMovementPreviewSchema
>;
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
export type InventoryMovementListParams = z.infer<
  typeof inventoryMovementListParamsSchema
>;
export type InventoryPage = z.infer<typeof inventoryPageSchema>;
export type InventoryMovementPage = z.infer<
  typeof inventoryMovementPageSchema
>;

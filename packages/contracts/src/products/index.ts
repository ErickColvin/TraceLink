import { z } from "zod";

import {
  clpAmountSchema,
  entityIdSchema,
  nonNegativeIntegerSchema,
} from "../common/index.js";
import {
  createPaginatedResponseSchema,
  pageSchema,
  pageSizeSchema,
} from "../pagination/index.js";

export const PRODUCT_AVAILABILITIES = [
  "ALL",
  "IN_STOCK",
  "OUT_OF_STOCK",
] as const;
export const PRODUCT_SORT_OPTIONS = [
  "FEATURED",
  "NAME_ASC",
  "NAME_DESC",
  "PRICE_ASC",
  "PRICE_DESC",
] as const;
export const PRODUCT_ADMIN_SORT_OPTIONS = [
  "NAME_ASC",
  "NAME_DESC",
  "PRICE_ASC",
  "PRICE_DESC",
  "SKU_ASC",
] as const;
export const PRODUCT_ACTIVE_FILTERS = ["ALL", "ACTIVE", "INACTIVE"] as const;
export const PRODUCT_PUBLICATION_FILTERS = [
  "ALL",
  "PUBLISHED",
  "UNPUBLISHED",
] as const;

export const productAvailabilitySchema = z.enum(PRODUCT_AVAILABILITIES);
export const productSortSchema = z.enum(PRODUCT_SORT_OPTIONS);
export const productAdminSortSchema = z.enum(PRODUCT_ADMIN_SORT_OPTIONS);
export const productActiveFilterSchema = z.enum(PRODUCT_ACTIVE_FILTERS);
export const productPublicationFilterSchema = z.enum(
  PRODUCT_PUBLICATION_FILTERS,
);

export const productCategorySchema = z
  .object({
    id: entityIdSchema,
    slug: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2_000),
    imageUrl: z.string().trim().min(1).max(2_048).optional(),
  })
  .strict();

const productCommercialShape = {
  sku: z.string().trim().min(1).max(100),
  barcode: z.string().trim().min(1).max(100).optional(),
  slug: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).optional(),
  brand: z.string().trim().min(1).max(160).optional(),
  categoryId: entityIdSchema,
  salePrice: clpAmountSchema,
  minimumStock: nonNegativeIntegerSchema.optional(),
  imageUrl: z.string().trim().min(1).max(2_048).optional(),
  published: z.boolean(),
  active: z.boolean(),
} satisfies z.ZodRawShape;

export const productCommercialInputSchema = z
  .object(productCommercialShape)
  .strict();

export const productSchema = z
  .object({
    id: entityIdSchema,
    ...productCommercialShape,
    availableStock: nonNegativeIntegerSchema,
    featured: z.boolean(),
  })
  .strict();

export const productListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    categoryId: entityIdSchema.optional(),
    availability: productAvailabilitySchema.optional(),
    sort: productSortSchema.optional(),
    featured: z.coerce.boolean().optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const productAdminListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    categoryId: entityIdSchema.optional(),
    active: productActiveFilterSchema.optional(),
    publication: productPublicationFilterSchema.optional(),
    sort: productAdminSortSchema.optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const productIdParamsSchema = z
  .object({ id: entityIdSchema })
  .strict();
export const productSlugParamsSchema = z
  .object({ slug: z.string().trim().min(1).max(160) })
  .strict();
export const relatedProductsQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).optional() })
  .strict();
export const setProductActiveRequestSchema = z
  .object({ active: z.boolean() })
  .strict();
export const setProductPublishedRequestSchema = z
  .object({ published: z.boolean() })
  .strict();

export const productPageSchema = createPaginatedResponseSchema(productSchema);

export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;
export type ProductSort = z.infer<typeof productSortSchema>;
export type ProductAdminSort = z.infer<typeof productAdminSortSchema>;
export type ProductActiveFilter = z.infer<typeof productActiveFilterSchema>;
export type ProductPublicationFilter = z.infer<
  typeof productPublicationFilterSchema
>;
export type ProductCategory = z.infer<typeof productCategorySchema>;
export type ProductCommercialInput = z.infer<
  typeof productCommercialInputSchema
>;
export type Product = z.infer<typeof productSchema>;
export type ProductListParams = z.infer<typeof productListParamsSchema>;
export type ProductAdminListParams = z.infer<
  typeof productAdminListParamsSchema
>;
export type ProductPage = z.infer<typeof productPageSchema>;
export type SetProductActiveRequest = z.infer<
  typeof setProductActiveRequestSchema
>;
export type SetProductPublishedRequest = z.infer<
  typeof setProductPublishedRequestSchema
>;

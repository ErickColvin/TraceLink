import { z } from "zod";

export const pageSchema = z.coerce.number().int().min(1);
export const pageSizeSchema = z.coerce.number().int().min(1).max(100);

export const paginationQuerySchema = z
  .object({
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const paginationMetadataSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();

export function createPaginatedResponseSchema<ItemSchema extends z.ZodType>(
  itemSchema: ItemSchema,
) {
  return paginationMetadataSchema
    .extend({
      items: z.array(itemSchema),
    })
    .strict();
}

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;

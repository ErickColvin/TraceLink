export const PRODUCT_AVAILABILITIES = ["ALL", "IN_STOCK", "OUT_OF_STOCK"] as const;

export type ProductAvailability = (typeof PRODUCT_AVAILABILITIES)[number];

export const PRODUCT_SORT_OPTIONS = [
  "FEATURED",
  "NAME_ASC",
  "NAME_DESC",
  "PRICE_ASC",
  "PRICE_DESC",
] as const;

export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number];

export const PRODUCT_ADMIN_SORT_OPTIONS = [
  "NAME_ASC",
  "NAME_DESC",
  "PRICE_ASC",
  "PRICE_DESC",
  "SKU_ASC",
] as const;

export type ProductAdminSort = (typeof PRODUCT_ADMIN_SORT_OPTIONS)[number];

export const PRODUCT_ACTIVE_FILTERS = ["ALL", "ACTIVE", "INACTIVE"] as const;

export type ProductActiveFilter = (typeof PRODUCT_ACTIVE_FILTERS)[number];

export const PRODUCT_PUBLICATION_FILTERS = [
  "ALL",
  "PUBLISHED",
  "UNPUBLISHED",
] as const;

export type ProductPublicationFilter =
  (typeof PRODUCT_PUBLICATION_FILTERS)[number];

export interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  slug: string;
  name: string;
  description?: string;
  brand?: string;
  categoryId: string;
  salePrice: number;
  imageUrl?: string;
  availableStock: number;
  minimumStock?: number;
  published: boolean;
  active: boolean;
  featured: boolean;
}

export interface ProductListParams {
  search?: string;
  categoryId?: string;
  availability?: ProductAvailability;
  sort?: ProductSort;
  featured?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductPage {
  items: Product[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ProductAdminListParams {
  search?: string;
  categoryId?: string;
  active?: ProductActiveFilter;
  publication?: ProductPublicationFilter;
  sort?: ProductAdminSort;
  page?: number;
  pageSize?: number;
}

/**
 * Commercial data owned by the product catalogue. Stock quantities are
 * deliberately absent: they can only change through inventory movements.
 */
export interface ProductCommercialInput {
  sku: string;
  barcode?: string;
  slug: string;
  name: string;
  description?: string;
  brand?: string;
  categoryId: string;
  salePrice: number;
  minimumStock?: number;
  imageUrl?: string;
  published: boolean;
  active: boolean;
}

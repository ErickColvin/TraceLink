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

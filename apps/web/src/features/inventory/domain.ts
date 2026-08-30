export const INVENTORY_STATUSES = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "EXPIRING_SOON",
  "EXPIRED",
] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export interface InventoryItem {
  id: string;
  productId: string;
  sku: string;
  barcode?: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  stock: number;
  availableStock: number;
  minimumStock: number;
  location: string;
  batch?: string;
  expiresAt?: string;
  status: InventoryStatus;
  updatedAt: string;
}

export const INVENTORY_SORT_OPTIONS = [
  "PRODUCT_ASC",
  "STOCK_ASC",
  "STOCK_DESC",
  "EXPIRY_ASC",
] as const;

export type InventorySort = (typeof INVENTORY_SORT_OPTIONS)[number];

export interface InventoryListParams {
  search?: string;
  categoryId?: string;
  statuses?: InventoryStatus[];
  sort?: InventorySort;
  page?: number;
  pageSize?: number;
}

export interface InventoryPage {
  items: InventoryItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

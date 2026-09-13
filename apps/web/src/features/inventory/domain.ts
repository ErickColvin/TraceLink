export const INVENTORY_STATUSES = [
  "OK",
  "LOW",
  "OUT",
  "EXPIRING",
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
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  minimumStock: number;
  location: string;
  batch?: string;
  expiresAt?: string;
  status: InventoryStatus;
  updatedAt: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
}

export const INVENTORY_SORT_OPTIONS = [
  "PRODUCT_ASC",
  "AVAILABLE_ASC",
  "AVAILABLE_DESC",
  "EXPIRY_ASC",
  "UPDATED_DESC",
] as const;

export type InventorySort = (typeof INVENTORY_SORT_OPTIONS)[number];

export const INVENTORY_EXPIRY_FILTERS = [
  "WITH_EXPIRY",
  "WITHOUT_EXPIRY",
  "EXPIRING",
  "EXPIRED",
] as const;

export type InventoryExpiryFilter =
  (typeof INVENTORY_EXPIRY_FILTERS)[number];

export interface InventoryListParams {
  search?: string;
  categoryId?: string;
  location?: string;
  expiry?: InventoryExpiryFilter;
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

export type InventoryMovementType =
  (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_ADJUSTMENT_DIRECTIONS = [
  "INCREASE",
  "DECREASE",
] as const;

export type InventoryAdjustmentDirection =
  (typeof INVENTORY_ADJUSTMENT_DIRECTIONS)[number];

export interface InventoryStockSnapshot {
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
}

export interface CreateInventoryMovementInput {
  inventoryItemId: string;
  type: InventoryMovementType;
  quantity: number;
  adjustmentDirection: InventoryAdjustmentDirection;
  originLocation?: string;
  destinationLocation?: string;
  reason?: string;
  notes?: string;
}

export interface InventoryMovementPreview {
  inventoryItemId: string;
  quantityDelta: number;
  before: InventoryStockSnapshot;
  after: InventoryStockSnapshot;
  resultingStatus: InventoryStatus;
}

export interface InventoryMovement extends InventoryMovementPreview {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  type: InventoryMovementType;
  quantity: number;
  originLocation: string;
  destinationLocation?: string;
  batch?: string;
  expiresAt?: string;
  reason?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface InventoryMovementListParams {
  search?: string;
  inventoryItemId?: string;
  types?: InventoryMovementType[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface InventoryMovementPage {
  items: InventoryMovement[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

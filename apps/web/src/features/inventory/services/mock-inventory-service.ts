import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import {
  mockInventoryItems,
  mockInventoryMovements,
} from "../data/mock-inventory";
import type {
  CreateInventoryMovementInput,
  InventoryCategory,
  InventoryItem,
  InventoryListParams,
  InventoryMovement,
  InventoryMovementListParams,
  InventoryMovementPage,
  InventoryPage,
  InventorySort,
} from "../domain";
import {
  deriveInventoryStatus,
  previewInventoryMovement,
} from "../rules/inventory-movement-rules";
import {
  InventoryItemNotFoundError,
  type InventoryService,
} from "./inventory-service";

const DEFAULT_PAGE_SIZE = 20;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase(tenantBrand.locale);
}

function copyInventoryItem(item: InventoryItem): InventoryItem {
  return { ...item };
}

function projectInventoryItem(item: InventoryItem, now: Date): InventoryItem {
  const expired = item.expiresAt
    ? Date.parse(item.expiresAt) <= now.getTime()
    : false;
  const availableStock = expired ? 0 : item.availableStock;

  return {
    ...item,
    availableStock,
    status: deriveInventoryStatus(
      {
        physicalStock: item.physicalStock,
        reservedStock: item.reservedStock,
        availableStock,
      },
      item.minimumStock,
      item.expiresAt,
      now,
    ),
  };
}

function copyMovement(movement: InventoryMovement): InventoryMovement {
  return {
    ...movement,
    before: { ...movement.before },
    after: { ...movement.after },
  };
}

function sortInventory(
  items: InventoryItem[],
  sort: InventorySort,
): InventoryItem[] {
  return items.sort((left, right) => {
    switch (sort) {
      case "PRODUCT_ASC":
        return left.productName.localeCompare(
          right.productName,
          tenantBrand.locale,
        );
      case "AVAILABLE_ASC":
        return left.availableStock - right.availableStock;
      case "AVAILABLE_DESC":
        return right.availableStock - left.availableStock;
      case "EXPIRY_ASC": {
        const leftTime = left.expiresAt
          ? Date.parse(left.expiresAt)
          : Number.POSITIVE_INFINITY;
        const rightTime = right.expiresAt
          ? Date.parse(right.expiresAt)
          : Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      }
      case "UPDATED_DESC":
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    }
  });
}

function paginate<T>(
  items: T[],
  requestedPage: number | undefined,
  requestedPageSize: number | undefined,
): {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
} {
  const page = Math.max(1, Math.trunc(requestedPage ?? 1));
  const pageSize = Math.max(
    1,
    Math.trunc(requestedPageSize ?? DEFAULT_PAGE_SIZE),
  );
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}

export class MockInventoryService implements InventoryService {
  private readonly inventoryItems: InventoryItem[];
  private readonly inventoryMovements: InventoryMovement[];
  private movementSequence: number;

  constructor(
    initialItems: readonly InventoryItem[] = mockInventoryItems,
    initialMovements: readonly InventoryMovement[] = mockInventoryMovements,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.inventoryItems = initialItems.map(copyInventoryItem);
    this.inventoryMovements = initialMovements.map(copyMovement);
    this.movementSequence = initialMovements.length;
  }

  getAvailableStockByProductId(productId: string): number | undefined {
    const matchingItems = this.inventoryItems.filter(
      (item) => item.productId === productId,
    );
    if (matchingItems.length === 0) return undefined;

    const now = this.now();
    return matchingItems.reduce(
      (total, item) => total + projectInventoryItem(item, now).availableStock,
      0,
    );
  }

  async list(params: InventoryListParams = {}): Promise<InventoryPage> {
    await delay(170);

    const search = params.search ? normalizeText(params.search) : undefined;
    const statuses = params.statuses ? new Set(params.statuses) : undefined;
    const location = params.location
      ? normalizeText(params.location)
      : undefined;
    const now = this.now();
    const filtered = this.inventoryItems
      .map((item) => projectInventoryItem(item, now))
      .filter(
        (item) => !params.categoryId || item.categoryId === params.categoryId,
      )
      .filter((item) => !statuses || statuses.has(item.status))
      .filter(
        (item) => !location || normalizeText(item.location).includes(location),
      )
      .filter((item) => {
        switch (params.expiry) {
          case "WITH_EXPIRY":
            return Boolean(item.expiresAt);
          case "WITHOUT_EXPIRY":
            return !item.expiresAt;
          case "EXPIRING":
            return item.status === "EXPIRING";
          case "EXPIRED":
            return item.status === "EXPIRED";
          case undefined:
            return true;
        }
      })
      .filter((item) => {
        if (!search) return true;
        return normalizeText(
          `${item.productName} ${item.sku} ${item.barcode ?? ""} ${item.batch ?? ""} ${item.location}`,
        ).includes(search);
      });
    const sorted = sortInventory(filtered, params.sort ?? "PRODUCT_ASC");

    return paginate(sorted, params.page, params.pageSize);
  }

  async listCategories(): Promise<InventoryCategory[]> {
    await delay(80);

    return Array.from(
      new Map(
        this.inventoryItems.map((item) => [
          item.categoryId,
          { id: item.categoryId, name: item.categoryName },
        ]),
      ).values(),
    ).sort((left, right) =>
      left.name.localeCompare(right.name, tenantBrand.locale),
    );
  }

  async getById(id: string): Promise<InventoryItem> {
    await delay(120);
    const item = this.inventoryItems.find((candidate) => candidate.id === id);

    if (!item) throw new InventoryItemNotFoundError(id);
    return projectInventoryItem(item, this.now());
  }

  async listMovements(
    params: InventoryMovementListParams = {},
  ): Promise<InventoryMovementPage> {
    await delay(140);

    const search = params.search ? normalizeText(params.search) : undefined;
    const types = params.types ? new Set(params.types) : undefined;
    const fromTime = params.dateFrom
      ? Date.parse(`${params.dateFrom}T00:00:00.000Z`)
      : Number.NEGATIVE_INFINITY;
    const toTime = params.dateTo
      ? Date.parse(`${params.dateTo}T23:59:59.999Z`)
      : Number.POSITIVE_INFINITY;
    const filtered = this.inventoryMovements
      .filter(
        (movement) =>
          !params.inventoryItemId ||
          movement.inventoryItemId === params.inventoryItemId,
      )
      .filter((movement) => !types || types.has(movement.type))
      .filter((movement) => {
        const createdAt = Date.parse(movement.createdAt);
        return createdAt >= fromTime && createdAt <= toTime;
      })
      .filter((movement) => {
        if (!search) return true;
        return normalizeText(
          `${movement.productName} ${movement.sku} ${movement.batch ?? ""} ${movement.originLocation} ${movement.destinationLocation ?? ""} ${movement.reason ?? ""} ${movement.notes ?? ""}`,
        ).includes(search);
      })
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      )
      .map(copyMovement);

    return paginate(filtered, params.page, params.pageSize);
  }

  async createMovement(
    input: CreateInventoryMovementInput,
  ): Promise<InventoryMovement> {
    await delay(220);

    const item = this.inventoryItems.find(
      (candidate) => candidate.id === input.inventoryItemId,
    );
    if (!item) throw new InventoryItemNotFoundError(input.inventoryItemId);

    const now = this.now();
    const preview = previewInventoryMovement(item, input, now);
    item.physicalStock = preview.after.physicalStock;
    item.reservedStock = preview.after.reservedStock;
    item.availableStock = preview.after.availableStock;
    item.status = preview.resultingStatus;
    item.updatedAt = now.toISOString();

    this.movementSequence += 1;
    const isIncoming =
      input.type === "PURCHASE_RECEIPT" ||
      input.type === "RETURN" ||
      input.type === "TRANSFER_IN";
    const defaultOrigin =
      input.type === "PURCHASE_RECEIPT"
        ? "Proveedor / recepción"
        : input.type === "RETURN"
          ? "Cliente / devolución"
          : item.location;
    const defaultDestination = isIncoming
      ? item.location
      : input.type === "DAMAGE" || input.type === "EXPIRED"
        ? "Zona de cuarentena"
        : undefined;
    const movement: InventoryMovement = {
      ...preview,
      id: `movement-demo-${String(this.movementSequence).padStart(4, "0")}`,
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      type: input.type,
      quantity: input.quantity,
      originLocation: input.originLocation?.trim() || defaultOrigin,
      destinationLocation:
        input.destinationLocation?.trim() || defaultDestination,
      batch: item.batch,
      expiresAt: item.expiresAt,
      reason: input.reason?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: now.toISOString(),
      createdBy: "Personal demo",
    };

    this.inventoryMovements.unshift(movement);
    return copyMovement(movement);
  }
}

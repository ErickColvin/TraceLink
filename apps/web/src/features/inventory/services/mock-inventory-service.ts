import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import { mockInventoryItems } from "../data/mock-inventory";
import type {
  InventoryItem,
  InventoryListParams,
  InventoryPage,
  InventorySort,
} from "../domain";
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

function sortInventory(items: InventoryItem[], sort: InventorySort): InventoryItem[] {
  return items.sort((left, right) => {
    switch (sort) {
      case "PRODUCT_ASC":
        return left.productName.localeCompare(right.productName, tenantBrand.locale);
      case "STOCK_ASC":
        return left.availableStock - right.availableStock;
      case "STOCK_DESC":
        return right.availableStock - left.availableStock;
      case "EXPIRY_ASC": {
        const leftTime = left.expiresAt ? Date.parse(left.expiresAt) : Number.POSITIVE_INFINITY;
        const rightTime = right.expiresAt ? Date.parse(right.expiresAt) : Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      }
    }
  });
}

export class MockInventoryService implements InventoryService {
  async list(params: InventoryListParams = {}): Promise<InventoryPage> {
    await delay(170);

    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const search = params.search ? normalizeText(params.search) : undefined;
    const statuses = params.statuses ? new Set(params.statuses) : undefined;
    const filtered = mockInventoryItems
      .filter((item) => !params.categoryId || item.categoryId === params.categoryId)
      .filter((item) => !statuses || statuses.has(item.status))
      .filter((item) => {
        if (!search) return true;
        return normalizeText(
          `${item.productName} ${item.sku} ${item.barcode ?? ""} ${item.batch ?? ""} ${item.location}`,
        ).includes(search);
      })
      .map((item) => ({ ...item }));
    const sorted = sortInventory(filtered, params.sort ?? "PRODUCT_ASC");
    const totalItems = sorted.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      page,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  async getById(id: string): Promise<InventoryItem> {
    await delay(120);
    const item = mockInventoryItems.find((candidate) => candidate.id === id);

    if (!item) throw new InventoryItemNotFoundError(id);
    return { ...item };
  }
}

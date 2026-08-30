import type { InventoryItem, InventoryListParams, InventoryPage } from "../domain";

export interface InventoryService {
  list(params?: InventoryListParams): Promise<InventoryPage>;
  getById(id: string): Promise<InventoryItem>;
}

export class InventoryItemNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el registro de inventario '${id}'.`);
    this.name = "InventoryItemNotFoundError";
  }
}

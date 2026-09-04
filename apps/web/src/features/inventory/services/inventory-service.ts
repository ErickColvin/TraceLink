import type {
  CreateInventoryMovementInput,
  InventoryCategory,
  InventoryItem,
  InventoryListParams,
  InventoryMovement,
  InventoryMovementListParams,
  InventoryMovementPage,
  InventoryPage,
} from "../domain";
import type { RequestOptions } from "../../../lib/http/http-client";

export interface InventoryService {
  list(params?: InventoryListParams): Promise<InventoryPage>;
  listCategories(): Promise<InventoryCategory[]>;
  getById(id: string): Promise<InventoryItem>;
  listMovements(
    params?: InventoryMovementListParams,
  ): Promise<InventoryMovementPage>;
  createMovement(
    input: CreateInventoryMovementInput,
    options?: RequestOptions,
  ): Promise<InventoryMovement>;
}

export class InventoryItemNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el registro de inventario '${id}'.`);
    this.name = "InventoryItemNotFoundError";
  }
}

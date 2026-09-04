import {
  inventoryCategorySchema,
  inventoryItemSchema,
  inventoryMovementPageSchema,
  inventoryMovementSchema,
  inventoryPageSchema,
} from "@tracelink/contracts";

import {
  encodePathSegment,
  type HttpClient,
  resolveIdempotencyKey,
  type RequestOptions,
} from "@/lib/http/http-client";

import type {
  CreateInventoryMovementInput,
  InventoryListParams,
  InventoryMovementListParams,
} from "../domain";
import type { InventoryService } from "./inventory-service";

const inventoryCategoryListSchema = inventoryCategorySchema.array();

export class HttpInventoryService implements InventoryService {
  constructor(private readonly client: HttpClient) {}

  list(params?: InventoryListParams) {
    return this.client.request("/staff/inventory", {
      responseSchema: inventoryPageSchema,
      ...(params === undefined ? {} : { query: params }),
    });
  }

  listCategories() {
    return this.client.request("/staff/inventory/categories", {
      responseSchema: inventoryCategoryListSchema,
    });
  }

  getById(id: string) {
    return this.client.request(`/staff/inventory/${encodePathSegment(id)}`, {
      responseSchema: inventoryItemSchema,
    });
  }

  listMovements(params?: InventoryMovementListParams) {
    return this.client.request("/staff/inventory/movements", {
      responseSchema: inventoryMovementPageSchema,
      ...(params === undefined ? {} : { query: params }),
    });
  }

  createMovement(
    input: CreateInventoryMovementInput,
    options?: RequestOptions,
  ) {
    return this.client.request("/staff/inventory/movements", {
      method: "POST",
      body: input,
      csrf: true,
      idempotencyKey: resolveIdempotencyKey(options),
      responseSchema: inventoryMovementSchema,
    });
  }
}

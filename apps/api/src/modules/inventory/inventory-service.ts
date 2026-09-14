import type {
  CreateInventoryMovementRequest,
  InventoryCategory,
  InventoryItem,
  InventoryListParams,
  InventoryMovement,
  InventoryMovementListParams,
  InventoryMovementPage,
  InventoryPage,
} from "@tracelink/contracts";
import { inventoryMovementSchema } from "@tracelink/contracts";

import type { PostgresDatabase } from "../../database/index.js";
import {
  IdempotencyService,
  type IdempotencyExecution,
} from "../../shared/idempotency/idempotency.js";
import { PostgresInventoryRepository } from "./inventory-repository.js";

export class InventoryService {
  readonly #repository: PostgresInventoryRepository;
  readonly #idempotency: IdempotencyService;

  constructor(database: PostgresDatabase, idempotencySecret: string) {
    this.#repository = new PostgresInventoryRepository(database);
    this.#idempotency = new IdempotencyService(database, idempotencySecret);
  }

  list(organizationId: string, params: InventoryListParams): Promise<InventoryPage> {
    return this.#repository.list(organizationId, params);
  }

  listCategories(organizationId: string): Promise<InventoryCategory[]> {
    return this.#repository.listCategories(organizationId);
  }

  getById(organizationId: string, id: string): Promise<InventoryItem> {
    return this.#repository.getById(organizationId, id);
  }

  listMovements(
    organizationId: string,
    params: InventoryMovementListParams,
  ): Promise<InventoryMovementPage> {
    return this.#repository.listMovements(organizationId, params);
  }

  createMovement(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    input: CreateInventoryMovementRequest;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<IdempotencyExecution<InventoryMovement>> {
    return this.#idempotency.execute({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      key: options.idempotencyKey,
      operation: "inventory.movement.create",
      payload: options.input,
      requestId: options.requestId,
      responseSchema: inventoryMovementSchema,
      mutation: async (executor) => {
        const body = await this.#repository.createMovement(executor, options);
        return {
          statusCode: 201,
          body,
          resourceType: "InventoryMovement",
          resourceId: body.id,
        };
      },
    });
  }
}

import type { RequestHandler } from "express";
import {
  createInventoryMovementRequestSchema,
  inventoryIdParamsSchema,
  inventoryListParamsSchema,
  inventoryMovementListParamsSchema,
} from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { normalizeArrayQuery } from "../../shared/http/query.js";
import { readIdempotencyKey } from "../../shared/idempotency/idempotency.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { InventoryService } from "./inventory-service.js";

export function createInventoryController(service: InventoryService): Readonly<{
  list: RequestHandler;
  listCategories: RequestHandler;
  getById: RequestHandler;
  listMovements: RequestHandler;
  createMovement: RequestHandler;
}> {
  return {
    list: async (request, response) => {
      const auth = getAuthContext(request);
      const params = parseWithSchema(
        inventoryListParamsSchema,
        normalizeArrayQuery(request.query, ["statuses"]),
        "query",
      );
      response.status(200).json(await service.list(auth.organization.id, params));
    },
    listCategories: async (request, response) => {
      const auth = getAuthContext(request);
      response.status(200).json(await service.listCategories(auth.organization.id));
    },
    getById: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(inventoryIdParamsSchema, request.params, "params");
      response.status(200).json(await service.getById(auth.organization.id, id));
    },
    listMovements: async (request, response) => {
      const auth = getAuthContext(request);
      const params = parseWithSchema(
        inventoryMovementListParamsSchema,
        normalizeArrayQuery(request.query, ["types"]),
        "query",
      );
      response.status(200).json(
        await service.listMovements(auth.organization.id, params),
      );
    },
    createMovement: async (request, response) => {
      const auth = getAuthContext(request);
      const input = parseWithSchema(
        createInventoryMovementRequestSchema,
        request.body,
        "body",
      );
      const result = await service.createMovement({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        input,
        requestId: getResponseRequestId(response),
        idempotencyKey: readIdempotencyKey(request),
      });
      if (result.replayed) response.setHeader("Idempotency-Replayed", "true");
      response.status(result.statusCode).json(result.body);
    },
  };
}

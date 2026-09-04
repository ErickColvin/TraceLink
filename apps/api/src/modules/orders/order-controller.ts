import type { RequestHandler } from "express";
import {
  currentCustomerOrderListParamsSchema,
  orderCancellationRequestSchema,
  orderIdParamsSchema,
  orderTransitionRequestSchema,
  staffOrderListParamsSchema,
} from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { normalizeArrayQuery } from "../../shared/http/query.js";
import { readIdempotencyKey } from "../../shared/idempotency/idempotency.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { OrderService } from "./order-service.js";

function getCustomerIdentity(request: Parameters<RequestHandler>[0]): Readonly<{
  organizationId: string;
  customerId: string;
}> {
  const auth = getAuthContext(request);
  if (auth.audience !== "customer") {
    throw new Error("Customer middleware invariant failed.");
  }
  return {
    organizationId: auth.organization.id,
    customerId: auth.customerId,
  };
}

function sendIdempotentResult(
  response: Parameters<RequestHandler>[1],
  result: Awaited<ReturnType<OrderService["transitionStatus"]>>,
): void {
  if (result.replayed) response.setHeader("Idempotency-Replayed", "true");
  response.status(result.statusCode).json(result.body);
}

export function createOrderController(service: OrderService): Readonly<{
  listCurrentCustomer: RequestHandler;
  getCurrentCustomerById: RequestHandler;
  listStaff: RequestHandler;
  getStaffById: RequestHandler;
  transitionStatus: RequestHandler;
  cancel: RequestHandler;
}> {
  return {
    listCurrentCustomer: async (request, response) => {
      const identity = getCustomerIdentity(request);
      const params = parseWithSchema(
        currentCustomerOrderListParamsSchema,
        normalizeArrayQuery(request.query, ["statuses"]),
        "query",
      );
      response.status(200).json(
        await service.listCurrentCustomer(
          identity.organizationId,
          identity.customerId,
          params,
        ),
      );
    },
    getCurrentCustomerById: async (request, response) => {
      const identity = getCustomerIdentity(request);
      const { id } = parseWithSchema(orderIdParamsSchema, request.params, "params");
      response.status(200).json(
        await service.getCurrentCustomerById(
          identity.organizationId,
          identity.customerId,
          id,
        ),
      );
    },
    listStaff: async (request, response) => {
      const auth = getAuthContext(request);
      const params = parseWithSchema(
        staffOrderListParamsSchema,
        normalizeArrayQuery(request.query, [
          "statuses",
          "paymentStatuses",
          "fulfillmentMethods",
        ]),
        "query",
      );
      response.status(200).json(
        await service.listStaff(auth.organization.id, params),
      );
    },
    getStaffById: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(orderIdParamsSchema, request.params, "params");
      response.status(200).json(
        await service.getStaffById(auth.organization.id, id),
      );
    },
    transitionStatus: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(orderIdParamsSchema, request.params, "params");
      const input = parseWithSchema(
        orderTransitionRequestSchema,
        request.body,
        "body",
      );
      sendIdempotentResult(
        response,
        await service.transitionStatus({
          organizationId: auth.organization.id,
          orderId: id,
          actorUserId: auth.user.id,
          input,
          requestId: getResponseRequestId(response),
          idempotencyKey: readIdempotencyKey(request),
        }),
      );
    },
    cancel: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(orderIdParamsSchema, request.params, "params");
      const input = parseWithSchema(
        orderCancellationRequestSchema,
        request.body,
        "body",
      );
      sendIdempotentResult(
        response,
        await service.cancel({
          organizationId: auth.organization.id,
          orderId: id,
          actorUserId: auth.user.id,
          input,
          requestId: getResponseRequestId(response),
          idempotencyKey: readIdempotencyKey(request),
        }),
      );
    },
  };
}

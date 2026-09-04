import type { RequestHandler } from "express";
import {
  currentCustomerPackageListParamsSchema,
  deliverPackageRequestSchema,
  packageCustomerOptionListParamsSchema,
  packageIdParamsSchema,
  receivePackageRequestSchema,
  staffPackageListParamsSchema,
  transitionPackageRequestSchema,
} from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { normalizeArrayQuery } from "../../shared/http/query.js";
import { readIdempotencyKey } from "../../shared/idempotency/idempotency.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { PackageService } from "./package-service.js";

function customerIdentity(request: Parameters<RequestHandler>[0]): Readonly<{
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
  result: Awaited<ReturnType<PackageService["receive"]>>,
): void {
  if (result.replayed) response.setHeader("Idempotency-Replayed", "true");
  response.status(result.statusCode).json(result.body);
}

export function createPackageController(service: PackageService): Readonly<{
  listCurrentCustomer: RequestHandler;
  getCurrentCustomerById: RequestHandler;
  listStaff: RequestHandler;
  getStaffById: RequestHandler;
  listCustomerOptions: RequestHandler;
  receive: RequestHandler;
  transition: RequestHandler;
  deliver: RequestHandler;
}> {
  return {
    listCurrentCustomer: async (request, response) => {
      const identity = customerIdentity(request);
      const params = parseWithSchema(
        currentCustomerPackageListParamsSchema,
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
      const identity = customerIdentity(request);
      const { id } = parseWithSchema(packageIdParamsSchema, request.params, "params");
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
        staffPackageListParamsSchema,
        normalizeArrayQuery(request.query, ["statuses"]),
        "query",
      );
      response.status(200).json(
        await service.listStaff(auth.organization.id, params),
      );
    },
    getStaffById: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(packageIdParamsSchema, request.params, "params");
      response.status(200).json(
        await service.getStaffById(auth.organization.id, id),
      );
    },
    listCustomerOptions: async (request, response) => {
      const auth = getAuthContext(request);
      const params = parseWithSchema(
        packageCustomerOptionListParamsSchema,
        request.query,
        "query",
      );
      response.status(200).json(
        await service.listCustomerOptions(auth.organization.id, params),
      );
    },
    receive: async (request, response) => {
      const auth = getAuthContext(request);
      const input = parseWithSchema(receivePackageRequestSchema, request.body, "body");
      sendIdempotentResult(
        response,
        await service.receive({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          input,
          requestId: getResponseRequestId(response),
          idempotencyKey: readIdempotencyKey(request),
        }),
      );
    },
    transition: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(packageIdParamsSchema, request.params, "params");
      const input = parseWithSchema(
        transitionPackageRequestSchema,
        request.body,
        "body",
      );
      sendIdempotentResult(
        response,
        await service.transition({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          packageId: id,
          input,
          requestId: getResponseRequestId(response),
          idempotencyKey: readIdempotencyKey(request),
        }),
      );
    },
    deliver: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(packageIdParamsSchema, request.params, "params");
      const input = parseWithSchema(deliverPackageRequestSchema, request.body, "body");
      sendIdempotentResult(
        response,
        await service.deliver({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          packageId: id,
          input,
          requestId: getResponseRequestId(response),
          idempotencyKey: readIdempotencyKey(request),
        }),
      );
    },
  };
}

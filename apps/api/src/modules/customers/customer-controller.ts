import type { RequestHandler } from "express";
import {
  customerIdParamsSchema,
  customerProfileInputSchema,
  staffCustomerListParamsSchema,
  staffCustomerUpdateInputSchema,
} from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { CustomerService } from "./customer-service.js";

function getCustomerIdentity(request: Parameters<RequestHandler>[0]): Readonly<{
  organizationId: string;
  customerId: string;
  actorUserId: string;
}> {
  const auth = getAuthContext(request);
  if (auth.audience !== "customer") {
    throw new Error("Customer middleware invariant failed.");
  }
  return {
    organizationId: auth.organization.id,
    customerId: auth.customerId,
    actorUserId: auth.user.id,
  };
}

export function createCustomerController(service: CustomerService): Readonly<{
  getCurrent: RequestHandler;
  updateCurrent: RequestHandler;
  listStaff: RequestHandler;
  getStaffDetail: RequestHandler;
  updateStaff: RequestHandler;
}> {
  return {
    getCurrent: async (request, response) => {
      const identity = getCustomerIdentity(request);
      response.status(200).json(
        await service.getCurrent(identity.organizationId, identity.customerId),
      );
    },
    updateCurrent: async (request, response) => {
      const identity = getCustomerIdentity(request);
      const input = parseWithSchema(customerProfileInputSchema, request.body, "body");
      response.status(200).json(
        await service.updateCurrent({
          ...identity,
          input,
          requestId: getResponseRequestId(response),
        }),
      );
    },
    listStaff: async (request, response) => {
      const auth = getAuthContext(request);
      const params = parseWithSchema(
        staffCustomerListParamsSchema,
        request.query,
        "query",
      );
      response.status(200).json(
        await service.listStaff(auth.organization.id, params),
      );
    },
    getStaffDetail: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(customerIdParamsSchema, request.params, "params");
      response.status(200).json(
        await service.getStaffDetail(auth.organization.id, id),
      );
    },
    updateStaff: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(customerIdParamsSchema, request.params, "params");
      const input = parseWithSchema(
        staffCustomerUpdateInputSchema,
        request.body,
        "body",
      );
      response.status(200).json(
        await service.updateStaff({
          organizationId: auth.organization.id,
          customerId: id,
          actorUserId: auth.user.id,
          input,
          requestId: getResponseRequestId(response),
        }),
      );
    },
  };
}

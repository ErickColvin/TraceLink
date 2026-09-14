import type { RequestHandler } from "express";
import {
  staffUserIdParamsSchema,
  staffUserListParamsSchema,
  updateStaffUserAccessRequestSchema,
} from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { UserService } from "./user-service.js";

export function createUserController(service: UserService): Readonly<{
  list: RequestHandler;
  getById: RequestHandler;
  updateAccess: RequestHandler;
}> {
  return {
    list: async (request, response) => {
      const auth = getAuthContext(request);
      const params = parseWithSchema(
        staffUserListParamsSchema,
        request.query,
        "query",
      );
      response.status(200).json(
        await service.list(auth.organization.id, params),
      );
    },
    getById: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(
        staffUserIdParamsSchema,
        request.params,
        "params",
      );
      response.status(200).json(
        await service.getById(auth.organization.id, id),
      );
    },
    updateAccess: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(
        staffUserIdParamsSchema,
        request.params,
        "params",
      );
      const input = parseWithSchema(
        updateStaffUserAccessRequestSchema,
        request.body,
        "body",
      );
      response.status(200).json(
        await service.updateAccess({
          organizationId: auth.organization.id,
          membershipId: id,
          actorUserId: auth.user.id,
          input,
          requestId: getResponseRequestId(response),
        }),
      );
    },
  };
}

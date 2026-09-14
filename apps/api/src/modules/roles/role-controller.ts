import type { RequestHandler } from "express";
import {
  roleIdParamsSchema,
  updateRolePermissionsRequestSchema,
} from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { RoleService } from "./role-service.js";

export function createRoleController(service: RoleService): Readonly<{
  list: RequestHandler;
  getById: RequestHandler;
  updatePermissions: RequestHandler;
}> {
  return {
    list: async (request, response) => {
      const auth = getAuthContext(request);
      response.status(200).json(await service.list(auth.organization.id));
    },
    getById: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(
        roleIdParamsSchema,
        request.params,
        "params",
      );
      response.status(200).json(
        await service.getById(auth.organization.id, id),
      );
    },
    updatePermissions: async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(
        roleIdParamsSchema,
        request.params,
        "params",
      );
      const input = parseWithSchema(
        updateRolePermissionsRequestSchema,
        request.body,
        "body",
      );
      response.status(200).json(
        await service.updatePermissions({
          organizationId: auth.organization.id,
          roleId: id,
          actorUserId: auth.user.id,
          input,
          requestId: getResponseRequestId(response),
        }),
      );
    },
  };
}

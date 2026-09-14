import type { RequestHandler } from "express";
import { organizationSettingsInputSchema } from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { SettingsService } from "./settings-service.js";

export function createSettingsController(service: SettingsService): Readonly<{
  get: RequestHandler;
  update: RequestHandler;
}> {
  return {
    get: async (request, response) => {
      const auth = getAuthContext(request);
      response.status(200).json(await service.get(auth.organization.id));
    },
    update: async (request, response) => {
      const auth = getAuthContext(request);
      const input = parseWithSchema(
        organizationSettingsInputSchema,
        request.body,
        "body",
      );
      response.status(200).json(
        await service.update({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          input,
          requestId: getResponseRequestId(response),
        }),
      );
    },
  };
}

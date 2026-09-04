import type { RequestHandler } from "express";

import { getAuthContext } from "../../middleware/authenticate.js";
import type { DashboardService } from "./dashboard-service.js";

export function createDashboardController(
  service: DashboardService,
): Readonly<{ getOverview: RequestHandler }> {
  return {
    getOverview: async (request, response) => {
      const auth = getAuthContext(request);
      response.status(200).json(
        await service.getOverview(auth.organization.id),
      );
    },
  };
}

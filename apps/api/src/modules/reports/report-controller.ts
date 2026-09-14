import type { RequestHandler } from "express";
import { reportListParamsSchema } from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { ReportService } from "./report-service.js";

export function createReportController(service: ReportService): Readonly<{
  list: RequestHandler;
}> {
  return {
    list: async (request, response) => {
      const auth = getAuthContext(request);
      const params = parseWithSchema(
        reportListParamsSchema,
        request.query,
        "query",
      );
      response.status(200).json(
        await service.list(auth.organization.id, params),
      );
    },
  };
}

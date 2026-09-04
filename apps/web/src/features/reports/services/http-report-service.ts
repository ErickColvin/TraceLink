import { operationalReportSchema } from "@tracelink/contracts";

import type { HttpClient } from "@/lib/http/http-client";

import type { ReportListParams } from "../domain";
import type { ReportService } from "./report-service";

export class HttpReportService implements ReportService {
  constructor(private readonly client: HttpClient) {}

  list(params?: ReportListParams) {
    return this.client.request("/staff/reports", {
      responseSchema: operationalReportSchema,
      ...(params === undefined ? {} : { query: params }),
    });
  }
}

import type {
  OperationalReport,
  ReportListParams,
} from "@tracelink/contracts";

import { PostgresReportRepository } from "./report-repository.js";

export class ReportService {
  readonly #repository: PostgresReportRepository;

  constructor(repository: PostgresReportRepository) {
    this.#repository = repository;
  }

  list(
    organizationId: string,
    params: ReportListParams,
  ): Promise<OperationalReport> {
    return this.#repository.list(organizationId, params);
  }
}

import type { DashboardOverview } from "@tracelink/contracts";

import { PostgresDashboardRepository } from "./dashboard-repository.js";

export class DashboardService {
  readonly #repository: PostgresDashboardRepository;

  constructor(repository: PostgresDashboardRepository) {
    this.#repository = repository;
  }

  getOverview(organizationId: string): Promise<DashboardOverview> {
    return this.#repository.getOverview(organizationId);
  }
}

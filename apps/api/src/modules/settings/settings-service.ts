import type {
  OrganizationSettings,
  OrganizationSettingsInput,
} from "@tracelink/contracts";

import { PostgresSettingsRepository } from "./settings-repository.js";

export class SettingsService {
  readonly #repository: PostgresSettingsRepository;

  constructor(repository: PostgresSettingsRepository) {
    this.#repository = repository;
  }

  get(organizationId: string): Promise<OrganizationSettings> {
    return this.#repository.get(organizationId);
  }

  update(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    input: OrganizationSettingsInput;
    requestId: string;
  }>): Promise<OrganizationSettings> {
    return this.#repository.update(options);
  }
}

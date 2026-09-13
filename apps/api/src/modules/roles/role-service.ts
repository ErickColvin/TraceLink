import type {
  StaffRoleDefinition,
  UpdateRolePermissionsRequest,
} from "@tracelink/contracts";

import { PostgresRoleRepository } from "./role-repository.js";

export class RoleService {
  readonly #repository: PostgresRoleRepository;

  constructor(repository: PostgresRoleRepository) {
    this.#repository = repository;
  }

  list(organizationId: string): Promise<StaffRoleDefinition[]> {
    return this.#repository.list(organizationId);
  }

  getById(
    organizationId: string,
    roleId: string,
  ): Promise<StaffRoleDefinition> {
    return this.#repository.getById(organizationId, roleId);
  }

  updatePermissions(options: Readonly<{
    organizationId: string;
    roleId: string;
    actorUserId: string;
    input: UpdateRolePermissionsRequest;
    requestId: string;
  }>): Promise<StaffRoleDefinition> {
    return this.#repository.updatePermissions(options);
  }
}

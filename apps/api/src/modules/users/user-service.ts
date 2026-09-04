import type {
  StaffUser,
  StaffUserListParams,
  StaffUserPage,
  UpdateStaffUserAccessRequest,
} from "@tracelink/contracts";

import { PostgresUserRepository } from "./user-repository.js";

export class UserService {
  readonly #repository: PostgresUserRepository;

  constructor(repository: PostgresUserRepository) {
    this.#repository = repository;
  }

  list(
    organizationId: string,
    params: StaffUserListParams,
  ): Promise<StaffUserPage> {
    return this.#repository.list(organizationId, params);
  }

  getById(organizationId: string, membershipId: string): Promise<StaffUser> {
    return this.#repository.getById(organizationId, membershipId);
  }

  updateAccess(options: Readonly<{
    organizationId: string;
    membershipId: string;
    actorUserId: string;
    input: UpdateStaffUserAccessRequest;
    requestId: string;
  }>): Promise<StaffUser> {
    return this.#repository.updateAccess(options);
  }
}

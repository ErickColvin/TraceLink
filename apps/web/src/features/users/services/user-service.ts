import type { StaffUser, StaffUserListParams, StaffUserPage, UpdateStaffUserInput } from "../domain";

export interface UserService {
  list(params?: StaffUserListParams): Promise<StaffUserPage>;
  getById(id: string): Promise<StaffUser>;
  update(input: UpdateStaffUserInput): Promise<StaffUser>;
}

export class StaffUserNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el usuario '${id}'.`);
    this.name = "StaffUserNotFoundError";
  }
}

export class InvalidStaffUserRoleError extends Error {
  constructor(roleId: string) {
    super(`El rol '${roleId}' no existe.`);
    this.name = "InvalidStaffUserRoleError";
  }
}

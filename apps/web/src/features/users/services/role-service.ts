import type { StaffRoleDefinition, UpdateRolePermissionsInput } from "../domain";

export interface RoleService {
  list(): Promise<StaffRoleDefinition[]>;
  getById(id: string): Promise<StaffRoleDefinition>;
  updatePermissions(input: UpdateRolePermissionsInput): Promise<StaffRoleDefinition>;
}

export class StaffRoleNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el rol '${id}'.`);
    this.name = "StaffRoleNotFoundError";
  }
}

export class ProtectedRoleError extends Error {
  constructor() {
    super("El rol de superadministración conserva todos los permisos.");
    this.name = "ProtectedRoleError";
  }
}

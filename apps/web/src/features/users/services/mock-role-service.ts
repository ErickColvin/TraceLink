import { PERMISSIONS, type Permission } from "@/features/auth";
import { delay } from "@/lib/delay";

import { mockStaffRoles } from "../data/mock-roles";
import type { StaffRoleDefinition, UpdateRolePermissionsInput } from "../domain";
import { ProtectedRoleError, StaffRoleNotFoundError, type RoleService } from "./role-service";

const allowedPermissions = new Set<Permission>(PERMISSIONS);

function cloneRole(role: StaffRoleDefinition): StaffRoleDefinition {
  return { ...role, permissions: [...role.permissions] };
}

export class MockRoleService implements RoleService {
  private roles: StaffRoleDefinition[] = mockStaffRoles.map(cloneRole);

  async list(): Promise<StaffRoleDefinition[]> {
    await delay(120);
    return this.roles.map(cloneRole);
  }

  async getById(id: string): Promise<StaffRoleDefinition> {
    await delay(80);
    const role = this.roles.find((candidate) => candidate.id === id);
    if (!role) throw new StaffRoleNotFoundError(id);
    return cloneRole(role);
  }

  async updatePermissions(input: UpdateRolePermissionsInput): Promise<StaffRoleDefinition> {
    await delay(220);
    const index = this.roles.findIndex((candidate) => candidate.id === input.id);
    const current = this.roles[index];
    if (!current) throw new StaffRoleNotFoundError(input.id);
    if (current.code === "SUPER_ADMIN") throw new ProtectedRoleError();
    const permissions = [...new Set(input.permissions)].filter((permission) => allowedPermissions.has(permission));
    const updated: StaffRoleDefinition = { ...current, permissions };
    this.roles[index] = updated;
    return cloneRole(updated);
  }
}

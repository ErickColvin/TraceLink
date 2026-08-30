import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import { mockStaffRoles } from "../data/mock-roles";
import { mockStaffUsers } from "../data/mock-users";
import type { StaffUser, StaffUserListParams, StaffUserPage, UpdateStaffUserInput } from "../domain";
import { InvalidStaffUserRoleError, StaffUserNotFoundError, type UserService } from "./user-service";

const DEFAULT_PAGE_SIZE = 10;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase(tenantBrand.locale);
}

export class MockUserService implements UserService {
  private users: StaffUser[] = mockStaffUsers.map((user) => ({ ...user }));

  async list(params: StaffUserListParams = {}): Promise<StaffUserPage> {
    await delay(140);
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const search = params.search ? normalize(params.search) : undefined;
    const filtered = this.users
      .filter((user) => !params.status || user.status === params.status)
      .filter((user) => !params.roleId || user.roleId === params.roleId)
      .filter((user) => !search || normalize(`${user.firstName} ${user.lastName} ${user.email}`).includes(search))
      .sort((left, right) => `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`, tenantBrand.locale));
    const totalItems = filtered.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize).map((user) => ({ ...user })),
      page,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  async getById(id: string): Promise<StaffUser> {
    await delay(100);
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) throw new StaffUserNotFoundError(id);
    return { ...user };
  }

  async update(input: UpdateStaffUserInput): Promise<StaffUser> {
    await delay(220);
    const index = this.users.findIndex((candidate) => candidate.id === input.id);
    const current = this.users[index];
    if (!current) throw new StaffUserNotFoundError(input.id);
    if (!mockStaffRoles.some((role) => role.id === input.roleId)) {
      throw new InvalidStaffUserRoleError(input.roleId);
    }
    const updated: StaffUser = { ...current, status: input.status, roleId: input.roleId };
    this.users[index] = updated;
    return { ...updated };
  }
}

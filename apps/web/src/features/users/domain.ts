import type { Permission } from "@/features/auth";

export const STAFF_USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const ROLE_CODES = ["SUPER_ADMIN", "ADMIN", "INVENTORY", "OPERATIONS", "SALES", "WAREHOUSE"] as const;

export type StaffUserStatus = (typeof STAFF_USER_STATUSES)[number];
export type RoleCode = (typeof ROLE_CODES)[number];

export type StaffUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: StaffUserStatus;
  roleId: string;
  lastAccessAt?: string;
  createdAt: string;
};

export type StaffRoleDefinition = {
  id: string;
  code: RoleCode;
  label: string;
  description: string;
  permissions: Permission[];
  system: boolean;
};

export type StaffUserListParams = {
  search?: string;
  status?: StaffUserStatus;
  roleId?: string;
  page?: number;
  pageSize?: number;
};

export type StaffUserPage = {
  items: StaffUser[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type UpdateStaffUserInput = {
  id: string;
  status: StaffUserStatus;
  roleId: string;
};

export type UpdateRolePermissionsInput = {
  id: string;
  permissions: Permission[];
};

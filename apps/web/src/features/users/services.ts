import { MockRoleService } from "./services/mock-role-service";
import { MockUserService } from "./services/mock-user-service";
import type { RoleService } from "./services/role-service";
import type { UserService } from "./services/user-service";

export const userService: UserService = new MockUserService();
export const roleService: RoleService = new MockRoleService();

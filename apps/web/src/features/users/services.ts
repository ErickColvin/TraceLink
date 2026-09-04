import { applicationServices } from "../service-composition";
import type { RoleService } from "./services/role-service";
import type { UserService } from "./services/user-service";

export const userService: UserService = applicationServices.userService;
export const roleService: RoleService = applicationServices.roleService;

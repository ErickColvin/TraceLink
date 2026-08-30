import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { StaffUserListParams, UpdateRolePermissionsInput, UpdateStaffUserInput } from "../domain";
import { roleService, userService } from "../services";

export const userKeys = {
  all: ["staff-users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (params: StaffUserListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export const roleKeys = {
  all: ["staff-roles"] as const,
  list: () => [...roleKeys.all, "list"] as const,
};

export function useStaffUsers(params: StaffUserListParams = {}) {
  return useQuery({ queryKey: userKeys.list(params), queryFn: () => userService.list(params), staleTime: 60_000 });
}

export function useStaffUser(id: string | undefined) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de usuario.");
      return userService.getById(id);
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useStaffRoles() {
  return useQuery({ queryKey: roleKeys.list(), queryFn: () => roleService.list(), staleTime: 5 * 60_000 });
}

export function useUpdateStaffUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStaffUserInput) => userService.update(input),
    onSuccess: (user) => {
      queryClient.setQueryData(userKeys.detail(user.id), user);
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRolePermissionsInput) => roleService.updatePermissions(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

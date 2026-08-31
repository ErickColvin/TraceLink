import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeliverStaffPackageInput,
  ReceiveStaffPackageInput,
  StaffPackageListParams,
  TransitionStaffPackageInput,
} from "../domain";
import { staffPackageService } from "../services";

export const staffPackageKeys = {
  all: ["packages", "staff"] as const,
  lists: () => [...staffPackageKeys.all, "list"] as const,
  list: (params: StaffPackageListParams) =>
    [...staffPackageKeys.lists(), params] as const,
  details: () => [...staffPackageKeys.all, "detail"] as const,
  detail: (id: string) => [...staffPackageKeys.details(), id] as const,
};

export function useStaffPackages(params: StaffPackageListParams = {}) {
  return useQuery({
    queryKey: staffPackageKeys.list(params),
    queryFn: () => staffPackageService.list(params),
    staleTime: 15_000,
  });
}

export function useStaffPackage(id: string | undefined) {
  return useQuery({
    queryKey: staffPackageKeys.detail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de paquete.");
      return staffPackageService.getById(id);
    },
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useReceiveStaffPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReceiveStaffPackageInput) =>
      staffPackageService.receive(input),
    onSuccess: async (customerPackage) => {
      queryClient.setQueryData(
        staffPackageKeys.detail(customerPackage.id),
        customerPackage,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffPackageKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

export function useTransitionStaffPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransitionStaffPackageInput) =>
      staffPackageService.transitionStatus(input),
    onSuccess: async (customerPackage) => {
      queryClient.setQueryData(
        staffPackageKeys.detail(customerPackage.id),
        customerPackage,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffPackageKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

export function useDeliverStaffPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeliverStaffPackageInput) =>
      staffPackageService.deliver(input),
    onSuccess: async (customerPackage) => {
      queryClient.setQueryData(
        staffPackageKeys.detail(customerPackage.id),
        customerPackage,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffPackageKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

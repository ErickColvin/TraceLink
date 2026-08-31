import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CancelStaffOrderInput,
  StaffOrderListParams,
  TransitionStaffOrderInput,
} from "../domain";
import { staffOrderService } from "../services";

export const staffOrderKeys = {
  all: ["orders", "staff"] as const,
  lists: () => [...staffOrderKeys.all, "list"] as const,
  list: (params: StaffOrderListParams) =>
    [...staffOrderKeys.lists(), params] as const,
  details: () => [...staffOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...staffOrderKeys.details(), id] as const,
};

export function useStaffOrders(params: StaffOrderListParams = {}) {
  return useQuery({
    queryKey: staffOrderKeys.list(params),
    queryFn: () => staffOrderService.list(params),
    staleTime: 15_000,
  });
}

export function useStaffOrder(id: string | undefined) {
  return useQuery({
    queryKey: staffOrderKeys.detail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de pedido.");
      return staffOrderService.getById(id);
    },
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useTransitionStaffOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransitionStaffOrderInput) =>
      staffOrderService.transitionStatus(input),
    onSuccess: async (order) => {
      queryClient.setQueryData(staffOrderKeys.detail(order.id), order);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffOrderKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

export function useCancelStaffOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CancelStaffOrderInput) => staffOrderService.cancel(input),
    onSuccess: async (order) => {
      queryClient.setQueryData(staffOrderKeys.detail(order.id), order);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffOrderKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

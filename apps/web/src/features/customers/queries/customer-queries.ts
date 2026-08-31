import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { CUSTOMER_PRIVATE_QUERY_META } from "@/features/auth/query-scope";
import type {
  CustomerListParams,
  CustomerProfileInput,
  StaffCustomerUpdateInput,
} from "../domain";
import { customerSelfService, staffCustomerService } from "../services";

export const customerKeys = {
  all: ["customers"] as const,
  current: (customerId: string) =>
    [...customerKeys.all, "current", customerId] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export function useCurrentCustomer() {
  const { session } = useAuth();
  const customerId = session.kind === "customer" ? session.customer.customerId : null;

  return useQuery({
    queryKey: customerKeys.current(customerId ?? "anonymous"),
    queryFn: () => customerSelfService.getCurrent(),
    enabled: Boolean(customerId),
    meta: CUSTOMER_PRIVATE_QUERY_META,
    staleTime: 5 * 60_000,
  });
}

export function useStaffCustomers(params: CustomerListParams = {}) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => staffCustomerService.list(params),
    staleTime: 60_000,
  });
}

export function useStaffCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de cliente.");
      return staffCustomerService.getById(id);
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useUpdateCurrentCustomer() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const customerId = session.kind === "customer" ? session.customer.customerId : null;

  return useMutation({
    mutationFn: (input: CustomerProfileInput) =>
      customerSelfService.updateCurrent(input),
    onSuccess: async (customer) => {
      if (customerId) {
        queryClient.setQueryData(customerKeys.current(customerId), customer);
      }
      await queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: customerKeys.detail(customer.id) });
    },
  });
}

export function useUpdateStaffCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StaffCustomerUpdateInput }) =>
      staffCustomerService.update(id, input),
    onSuccess: async (detail) => {
      queryClient.setQueryData(customerKeys.detail(detail.customer.id), detail);
      await queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      await queryClient.invalidateQueries({
        queryKey: customerKeys.all,
        predicate: (query) => query.queryKey[1] === "current",
      });
    },
  });
}

/** Compatibility aliases for existing staff imports. */
export const useCustomers = useStaffCustomers;
export const useCustomer = useStaffCustomer;
